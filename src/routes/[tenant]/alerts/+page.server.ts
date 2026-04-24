import { getOpenAlerts, getAlertHistory } from '$db/alerts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	return {
		alerts: getOpenAlerts(params.tenant),
		history: getAlertHistory(params.tenant, 30),
	};
};
