package llm

import (
	"github.com/rush-maestro/rush-maestro/internal/connector"
	"github.com/rush-maestro/rush-maestro/internal/domain"
)

func init() {
	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderClaude,
		Group:       domain.GroupLLM,
		DisplayName: "Claude (Anthropic)",
		Description: "Generate content using Anthropic's Claude models.",
		LogoSVG:     claudeLogoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true,
				HelpText: "Found at console.anthropic.com → API Keys."},
		},
	})

	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderOpenAI,
		Group:       domain.GroupLLM,
		DisplayName: "OpenAI",
		Description: "Generate content using OpenAI's GPT models.",
		LogoSVG:     openaiLogoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true},
		},
	})

	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderGroq,
		Group:       domain.GroupLLM,
		DisplayName: "Groq",
		Description: "Fast inference using Groq's LPU acceleration.",
		LogoSVG:     groqLogoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true},
		},
	})

	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderGemini,
		Group:       domain.GroupLLM,
		DisplayName: "Gemini (Google)",
		Description: "Generate content using Google's Gemini models.",
		LogoSVG:     geminiLogoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true},
		},
	})

	connector.RegisterProvider(&connector.IntegrationSchema{
		Provider:    domain.ProviderKimi,
		Group:       domain.GroupLLM,
		DisplayName: "Kimi (Moonshot)",
		Description: "Generate content using Moonshot's Kimi models.",
		LogoSVG:     kimiLogoSVG,
		CredentialFields: []connector.FieldSchema{
			{Key: "oauth_client_secret", Label: "API Key", Type: connector.FieldTypePassword, Required: true,
				HelpText: "Found at platform.moonshot.cn → API Keys."},
		},
	})
}

const claudeLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#D97706"/><text x="24" y="33" font-size="16" font-weight="bold" text-anchor="middle" fill="white">AI</text></svg>`
const openaiLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#10A37F"/><text x="24" y="33" font-size="16" font-weight="bold" text-anchor="middle" fill="white">AI</text></svg>`
const groqLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#F55036"/><text x="24" y="33" font-size="14" font-weight="bold" text-anchor="middle" fill="white">Groq</text></svg>`
const geminiLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#4285F4"/><text x="24" y="33" font-size="12" font-weight="bold" text-anchor="middle" fill="white">Gemini</text></svg>`
const kimiLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#8E44AD"/><text x="24" y="33" font-size="12" font-weight="bold" text-anchor="middle" fill="white">Kimi</text></svg>`
