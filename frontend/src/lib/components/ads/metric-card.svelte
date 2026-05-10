<script lang="ts">
  import { TrendingUp, TrendingDown } from 'lucide-svelte'

  interface Delta { pct: string; dir: 'up' | 'down' | 'flat' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { icon: Icon, theme = 'indigo', label, value, subtitle, delta } = $props<{
    icon: any
    theme?: 'indigo' | 'blue' | 'emerald' | 'amber'
    label: string
    value: string | number
    subtitle?: string
    delta: Delta
  }>()

  const themes = {
    indigo: {
      hover: 'hover:border-indigo-200 dark:hover:border-indigo-800',
      iconBg: 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/30',
      watermark: 'text-indigo-500',
    },
    blue: {
      hover: 'hover:border-blue-200 dark:hover:border-blue-800',
      iconBg: 'bg-blue-50 text-blue-500 dark:bg-blue-900/30',
      watermark: 'text-blue-500',
    },
    emerald: {
      hover: 'hover:border-emerald-200 dark:hover:border-emerald-800',
      iconBg: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30',
      watermark: 'text-emerald-500',
    },
    amber: {
      hover: 'hover:border-amber-200 dark:hover:border-amber-800',
      iconBg: 'bg-amber-50 text-amber-500 dark:bg-amber-900/30',
      watermark: 'text-amber-500',
    },
  }

  const t = $derived(themes[theme as keyof typeof themes])
</script>

<div
  class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors {t.hover} dark:border-slate-800 dark:bg-slate-900"
>
  <div class="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
    <Icon class="h-16 w-16 {t.watermark}" />
  </div>
  <div class="relative z-10 mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
    <div class="flex h-8 w-8 items-center justify-center rounded-md {t.iconBg}">
      <Icon class="h-4 w-4" />
    </div>
    {label}
  </div>
  <div class="relative z-10 text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
  {#if subtitle}
    <div class="relative z-10 mt-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
      {subtitle}
    </div>
  {/if}
  {#if delta.dir !== 'flat'}
    <div class="relative z-10 mt-2 flex items-center gap-1">
      {#if delta.dir === 'up'}
        <TrendingUp class="h-3 w-3 text-emerald-500" />
        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400"
          >{delta.pct} vs prev. wk.</span
        >
      {:else}
        <TrendingDown class="h-3 w-3 text-red-400" />
        <span class="text-xs font-bold text-red-500 dark:text-red-400"
          >{delta.pct} vs prev. wk.</span
        >
      {/if}
    </div>
  {/if}
</div>
