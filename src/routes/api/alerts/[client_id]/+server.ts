import { json } from '@sveltejs/kit';
import { getOpenAlerts, resolveAlert, getAlertHistory } from '$db/alerts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const history = url.searchParams.get('history') === 'true';
	return json(
		history
			? getAlertHistory(params.client_id)
			: getOpenAlerts(params.client_id)
	);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json() as unknown;

	if (
		typeof body !== 'object' || body === null ||
		!('id' in body) || typeof (body as Record<string, unknown>).id !== 'number' ||
		!('action' in body) || !['resolved', 'ignored'].includes((body as Record<string, unknown>).action as string)
	) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	const { id, action } = body as { id: number; action: 'resolved' | 'ignored' };
	resolveAlert(id, action);
	return json({ success: true });
};
