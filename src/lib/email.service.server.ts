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

async function getMicrosoftGraphToken(): Promise<string | null> {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn(
      "[ServiceDesk] E-mail não enviado: configure MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET.",
    );
    return null;
  }

  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error(
        "[ServiceDesk] Falha ao obter token Microsoft Graph:",
        response.status,
        body,
      );
      return null;
    }

    const data = (await response.json()) as {
      access_token?: string;
    };

    return data.access_token ?? null;
  } catch (error) {
    console.error(
      "[ServiceDesk] Erro ao autenticar no Microsoft Graph:",
      error,
    );
    return null;
  }
}

export async function enviarEmailServiceDesk(
  args: EmailArgs,
): Promise<boolean> {
  if (!args.to) {
    return false;
  }

  const from = process.env.MICROSOFT_MAIL_FROM;
  if (!from) {
    console.warn(
      "[ServiceDesk] E-mail não enviado: configure MICROSOFT_MAIL_FROM.",
    );
    return false;
  }

  const accessToken = await getMicrosoftGraphToken();
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: args.subject,
            body: {
              contentType: "HTML",
              content: args.html,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: args.to,
                },
              },
            ],
          },
          saveToSentItems: true,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error(
        "[ServiceDesk] Falha ao enviar e-mail pelo Microsoft Graph:",
        response.status,
        body,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "[ServiceDesk] Erro ao enviar e-mail pelo Microsoft Graph:",
      error,
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
      <p><strong>SLA:</strong> ${esc(args.prazoSla ? new Date(args.prazoSla).toLocaleString("pt-BR") : "—")}</p>
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

export function emailChamadoResolvido(args: {
  para: string;
  numero: string;
  titulo: string;
  autor: string;
  link: string;
}) {
  return enviarEmailServiceDesk({
    to: args.para,
    subject: `[Service Desk] Chamado ${args.numero} resolvido`,
    html: `
      <h2>Chamado resolvido</h2>
      <p><strong>Chamado:</strong> ${esc(args.numero)}</p>
      <p><strong>Assunto:</strong> ${esc(args.titulo)}</p>
      <p><strong>Resolvido por:</strong> ${esc(args.autor)}</p>
      <p>O chamado foi marcado como resolvido no Service Desk.</p>
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
