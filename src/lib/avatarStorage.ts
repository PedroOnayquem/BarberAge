import { supabase } from './supabase'

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
export const SHOP_AVATARS_BUCKET = 'shop-avatars'
export const CLIENT_AVATARS_BUCKET = 'client-avatars'

let devBucketDiagnosticLogged = false
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

function getSafeExtension(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return 'Formato inválido. Envie JPG, PNG, WEBP ou GIF.'
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return 'Arquivo muito grande. O limite é 2MB.'
  }
  return null
}

export async function getSignedAvatarUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}

async function runDevBucketDiagnostic() {
  if (!import.meta.env.DEV || devBucketDiagnosticLogged) return

  devBucketDiagnosticLogged = true
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    console.info(`[avatar][dev-check] listBuckets() falhou: ${error.message}`)
    return
  }

  const bucketNames = (data || []).map((b) => b.id).join(', ') || '(nenhum bucket)'
  console.info(`[avatar][dev-check] listBuckets() retornou: ${bucketNames}`)
  if (!data || data.length === 0) {
    console.info(
      '[avatar][dev-check] Resultado vazio com chave anon pode ocorrer em buckets privados; ' +
      'a validação final acontece no upload.'
    )
  }
}

function mapUploadError(errorMessage: string, bucket: string): Error {
  if (errorMessage.toLowerCase().includes('bucket not found')) {
    const migration =
      bucket === 'client-avatars'
        ? 'supabase/migrations/20260225194000_create_client_avatars_bucket.sql'
        : 'supabase/migrations/20260225190000_create_shop_avatars_bucket.sql'
    return new Error(
      `Bucket '${bucket}' não existe neste projeto Supabase. ` +
      `Aplique a migration ${migration} no projeto correto.`
    )
  }
  return new Error(errorMessage)
}

export async function uploadShopAvatar(params: {
  file: File
  userId: string
  previousPath?: string | null
}) {
  const { file, userId, previousPath } = params
  await runDevBucketDiagnostic()
  const ext = getSafeExtension(file)
  const newPath = `avatars/${userId}/avatar-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('shop-avatars').upload(newPath, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })
  if (uploadError) throw mapUploadError(uploadError.message, 'shop-avatars')

  if (previousPath && previousPath !== newPath) {
    await supabase.storage.from('shop-avatars').remove([previousPath])
  }

  return newPath
}

export async function uploadClientAvatar(params: {
  file: File
  shopId: string
  clientId: string
  previousPath?: string | null
}) {
  const { file, shopId, clientId, previousPath } = params
  await runDevBucketDiagnostic()
  const ext = getSafeExtension(file)
  const newPath = `${shopId}/${clientId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage.from(CLIENT_AVATARS_BUCKET).upload(newPath, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })
  if (uploadError) throw mapUploadError(uploadError.message, CLIENT_AVATARS_BUCKET)

  if (previousPath && previousPath !== newPath) {
    await supabase.storage.from(CLIENT_AVATARS_BUCKET).remove([previousPath])
  }

  return newPath
}
