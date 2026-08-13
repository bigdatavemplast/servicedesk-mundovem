function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type EmailArgs = {
  to: string;
  subject: string;
  html: string;
};

async function obterAccessTokenGmail(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "[ServiceDesk] Configure GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN."
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `[ServiceDesk] Falha ao renovar token do Gmail: ${response.status} ${body}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(
      "[ServiceDesk] Google não retornou um access_token."
    );
  }

  return data.access_token;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function createRawEmail(args: EmailArgs, fromEmail: string): string {
  const message = [
    `From: Service Desk Mundo Vem <${fromEmail}>`,
    `To: ${args.to}`,
    `Subject: ${encodeSubject(args.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    args.html,
  ].join("\r\n");

  return encodeBase64Url(message);
}

export async function enviarEmailServiceDesk(
  args: EmailArgs
): Promise<boolean> {
  try {
    const fromEmail = process.env.GMAIL_FROM_EMAIL;

    if (!fromEmail || !args.to) {
      console.warn(
        "[ServiceDesk] E-mail não enviado: GMAIL_FROM_EMAIL ou destinatário não configurado."
      );
      return false;
    }

    const accessToken = await obterAccessTokenGmail();

    const raw = createRawEmail(args, fromEmail);

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw,
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();

      console.error(
        "[ServiceDesk] Falha ao enviar e-mail pelo Gmail:",
        response.status,
        body
      );

      return false;
    }

    const data = await response.json();

    console.log("[ServiceDesk] E-mail enviado pelo Gmail:", {
      para: args.to,
      assunto: args.subject,
      messageId: data?.id,
    });

    return true;
  } catch (error: any) {
    console.error(
      "[ServiceDesk] Erro ao enviar e-mail pelo Gmail:",
      error?.message ?? error
    );

    return false;
  }
}

export function emailChamadoAberto(args: {
  para: string;
  numero: string;
  titulo: string;
  solicitante: string;
  area: string;
  prioridade: string;
  descricao: string;
  prazoSla: string | null;
  link: string;
}) {
  return enviarEmailServiceDesk({
    to: args.para,
    subject: `[Service Desk] Novo chamado ${args.numero} - ${args.titulo}`,
    html: `
      <h2>Novo chamado aberto</h2>
      <p><strong>Chamado:</strong> ${esc(args.numero)}</p>
      <p><strong>Assunto:</strong> ${esc(args.titulo)}</p>
      <p><strong>Solicitante:</strong> ${esc(args.solicitante)}</p>
      <p><strong>Área:</strong> ${esc(args.area || "Sem área")}</p>
      <p><strong>Prioridade:</strong> ${esc(args.prioridade)}</p>
      <p><strong>SLA:</strong> ${esc(
        args.prazoSla
          ? new Date(args.prazoSla).toLocaleString("pt-BR")
          : "—"
      )}</p>
      <hr />
      <p>${esc(args.descricao).replaceAll("\n", "<br />")}</p>
      <p><a href="${esc(args.link)}">Abrir chamado</a></p>
    `,
  });
}

export function emailInteracao(args: {
  para: string;
  numero: string;
  titulo: string;
  autor: string;
  mensagem: string;
  status: string;
  slaStatus: string;
  link: string;
}) {
  return enviarEmailServiceDesk({
    to: args.para,
    subject: `[Service Desk] Atualização no chamado ${args.numero}`,
    html: `
      <h2>Nova interação no chamado</h2>
      <p><strong>Chamado:</strong> ${esc(args.numero)}</p>
      <p><strong>Assunto:</strong> ${esc(args.titulo)}</p>
      <p><strong>Quem respondeu:</strong> ${esc(args.autor)}</p>
      <p><strong>Status:</strong> ${esc(args.status)}</p>
      <p><strong>SLA:</strong> ${esc(args.slaStatus)}</p>
      <hr />
      <p>${esc(args.mensagem).replaceAll("\n", "<br />")}</p>
      <p><a href="${esc(args.link)}">Acessar chamado</a></p>
    `,
  });
}

export function emailChamadoFechado(args: {
  para: string;
  numero: string;
  titulo: string;
  autor: string;
  link: string;
}) {
  return enviarEmailServiceDesk({
    to: args.para,
    subject: `[Service Desk] Chamado ${args.numero} fechado`,
    html: `
      <h2>Chamado fechado</h2>
      <p><strong>Chamado:</strong> ${esc(args.numero)}</p>
      <p><strong>Assunto:</strong> ${esc(args.titulo)}</p>
      <p><strong>Fechado por:</strong> ${esc(args.autor)}</p>
      <p>O chamado foi encerrado no Service Desk.</p>
      <p><a href="${esc(args.link)}">Acessar chamado</a></p>
    `,
  });
}