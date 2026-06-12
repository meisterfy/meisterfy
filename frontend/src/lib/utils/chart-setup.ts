// Registers all chart.js controllers/elements/scales once. Imported for its
// side effect by charts.ts (config builders) and by every chart component, so
// react-chartjs-2's <Line>/<Bar> have everything registered before first render.
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)
