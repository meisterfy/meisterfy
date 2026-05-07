<script lang="ts">
	import * as SimpleIcons from '@icons-pack/svelte-simple-icons'
	import * as LucideIcons from 'lucide-svelte'

	let {
		provider,
		class: className = 'h-full w-full',
		size = undefined
	} = $props<{
		provider: string
		class?: string
		size?: number
	}>()

	const iconMap: Record<string, any> = {
		google_ads: SimpleIcons.SiGoogleads,
		meta: SimpleIcons.SiMeta,
		claude: SimpleIcons.SiClaude,
		anthropic: SimpleIcons.SiAnthropic,
		openai: SimpleIcons.SiOpenai || LucideIcons.Bot,
		groq: SimpleIcons.SiGroq || LucideIcons.Zap,
		gemini: SimpleIcons.SiGoogle || LucideIcons.Sparkles,
		brevo: SimpleIcons.SiBrevo,
		sentry: SimpleIcons.SiSentry,
		instagram: SimpleIcons.SiInstagram,
		instagram_feed: SimpleIcons.SiInstagram,
		instagram_stories: SimpleIcons.SiInstagram,
		instagram_reels: SimpleIcons.SiInstagram,
		facebook: SimpleIcons.SiFacebook,
		linkedin: SimpleIcons.SiLinkedin,
		r2: SimpleIcons.SiCloudflare || LucideIcons.Cloud,
		s3: SimpleIcons.SiAmazons3 || LucideIcons.Database,
		sendible: SimpleIcons.SiSendible || LucideIcons.Share2
	}

	const Icon = $derived(iconMap[provider] || LucideIcons.Puzzle)
</script>

<Icon class={className} {size} />
