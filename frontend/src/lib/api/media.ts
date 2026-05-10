import { apiFetch, getToken } from './client'

export async function uploadMedia(tenant: string, postId: string, files: FileList): Promise<string[]> {
	const fd = new FormData()
	for (let i = 0; i < files.length; i++) fd.append('file', files[i])
	// FormData/multipart upload — cannot use apiFetch (would override Content-Type)
	const token = getToken()
	const res = await fetch(`/api/media/${tenant}/${postId}`, {
		method: 'POST',
		body: fd,
		credentials: 'include',
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	})
	if (!res.ok) throw new Error(await res.text())
	const data: { media_files: string[] } = await res.json()
	return data.media_files
}

export async function deleteMedia(tenant: string, postId: string): Promise<void> {
	await apiFetch(`/api/media/${tenant}/${postId}`, { method: 'DELETE' })
}
