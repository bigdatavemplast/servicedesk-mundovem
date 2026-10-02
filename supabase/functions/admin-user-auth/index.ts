import { createClient } from "npm:@supabase/supabase-js@2"

type Action = "create" | "update" | "delete"
type Payload = {
  action: Action
  id?: string
  nome?: string
  email?: string
  senha?: string
  departamento?: string | null
  departamentoId?: string | null
  areaId?: string | null
  role?: "colaborador" | "atendente" | "gestor" | "admin"
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
}

function getSecretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (raw) {
    const keys = JSON.parse(raw)
    if (keys.default) return keys.default
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (legacy) return legacy
  throw new Error("Supabase secret key is not configured for Edge Functions")
}

async function getCaller(req: Request) {
  const auth = req.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) throw new Error("Unauthorized")
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")
  const publishableKey = publishable ? JSON.parse(publishable).default : Deno.env.get("SUPABASE_ANON_KEY")
  if (!publishableKey) throw new Error("Supabase publishable key is not configured")

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, publishableKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = auth.slice("Bearer ".length)
  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data.user) throw new Error("Unauthorized")

  const { data: roles, error: rolesError } = await userClient.from("user_roles").select("role").eq("user_id", data.user.id)
  if (rolesError) throw new Error(rolesError.message)

  const allowed = (roles ?? []).some((r) => r.role === "admin" || r.role === "gestor")
  if (!allowed) throw new Error("Forbidden: permissão insuficiente")
  return { userId: data.user.id }
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, getSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function removeOwnedStorageObjects(admin: ReturnType<typeof adminClient>, userId: string) {
  const { data: objects, error } = await admin
    .schema("storage")
    .from("objects")
    .select("bucket_id,name")
    .or("owner.eq." + userId + ",owner_id.eq." + userId)

  if (error) throw new Error("Falha ao verificar arquivos do usuário: " + error.message)
  if (!objects?.length) return

  const byBucket = new Map<string, string[]>()
  for (const object of objects) {
    const paths = byBucket.get(object.bucket_id) ?? []
    paths.push(object.name)
    byBucket.set(object.bucket_id, paths)
  }

  for (const [bucket, paths] of byBucket) {
    const { error: removeError } = await admin.storage.from(bucket).remove(paths)
    if (removeError) {
      throw new Error("Falha ao remover arquivos do usuário: " + removeError.message)
    }
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
    const { userId: callerId } = await getCaller(req)
    const body = (await req.json()) as Payload
    const admin = adminClient()

    if (body.action === "create") {
      if (!body.email || !body.senha || !body.nome || !body.role) return json({ error: "Dados obrigatórios ausentes" }, 400)
      const { data: created, error } = await admin.auth.admin.createUser({
        email: body.email, password: body.senha, email_confirm: true, user_metadata: { nome: body.nome },
      })
      if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário")
      const uid = created.user.id

      const { error: profileError } = await admin.from("profiles").upsert({
        id: uid, nome: body.nome, email: body.email, departamento: body.departamento ?? null,
        departamento_id: body.departamentoId ?? null, area_id: body.areaId ?? null, ativo: true,
      })
      if (profileError) {
        await admin.auth.admin.deleteUser(uid)
        throw new Error(profileError.message)
      }

      const { error: roleError } = await admin.from("user_roles").insert({ user_id: uid, role: body.role })
      if (roleError) {
        await admin.auth.admin.deleteUser(uid)
        throw new Error(roleError.message)
      }
      return json({ ok: true, id: uid })
    }

    if (!body.id) return json({ error: "ID do usuário é obrigatório" }, 400)

    if (body.action === "update") {
      const authUpdate: Record<string, string> = {}
      if (body.email) authUpdate.email = body.email
      if (body.senha) authUpdate.password = body.senha
      if (Object.keys(authUpdate).length) {
        const { error } = await admin.auth.admin.updateUserById(body.id, authUpdate)
        if (error) throw new Error(error.message)
      }
      return json({ ok: true })
    }

    if (body.action === "delete") {
      if (body.id === callerId) return json({ error: "Você não pode excluir a si mesmo" }, 400)
      await removeOwnedStorageObjects(admin, body.id)
      const { error } = await admin.auth.admin.deleteUser(body.id)
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    return json({ error: "Ação inválida" }, 400)
  } catch (error) {
    console.error("admin-user-auth error", error)
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 400)
  }
})
