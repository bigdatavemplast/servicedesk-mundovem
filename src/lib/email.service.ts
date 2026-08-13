
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

export async function enviarEmailServiceDesk(args: EmailArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from || !args.to) {
    console.warn("[ServiceDesk] E-mail não enviado: configure RESEND_API_KEY, RESEND_FROM_EMAIL e o destinatário.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[ServiceDesk] Falha ao enviar e-mail:", response.status, body);
    return false;
  }

  return true;
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
