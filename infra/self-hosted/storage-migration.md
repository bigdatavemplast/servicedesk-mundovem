# Migração de Storage

O aplicativo usa o bucket `chamados-anexos`.

O dump SQL não copia os objetos binários. A documentação oficial recomenda S3-to-S3 com `rclone`; copiar diretamente os arquivos do filesystem não é equivalente porque o Storage self-hosted usa uma estrutura interna diferente.

## Origem

Criar uma chave S3 somente para a migração e guardar os valores fora do Git.

Endpoint de origem:

```
https://<project-ref>.supabase.co/storage/v1/s3
```

## Destino

Habilitar o endpoint S3 no Storage self-hosted e criar previamente o bucket.

## rclone

```ini
[platform]
type = s3
provider = Other
access_key_id = <ORIGEM>
secret_access_key = <ORIGEM>
endpoint = https://<project-ref>.supabase.co/storage/v1/s3
region = <REGIAO>

[self-hosted]
type = s3
provider = Other
access_key_id = <DESTINO>
secret_access_key = <DESTINO>
endpoint = https://<DOMINIO>/storage/v1/s3
region = <REGIAO>
```

Validar:

```bash
rclone lsd platform:
rclone lsd self-hosted:
rclone size platform:chamados-anexos
rclone size self-hosted:chamados-anexos
```

Copiar:

```bash
rclone copy platform:chamados-anexos self-hosted:chamados-anexos --progress
```

Repetir a sincronização antes do cutover para capturar arquivos criados durante a janela de migração.

Depois, comparar quantidade/tamanho e testar URLs assinadas no aplicativo.

Nunca coloque as chaves S3 neste repositório.
