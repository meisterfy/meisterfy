-- +goose Up
INSERT INTO legal_term_versions (id, version, fallback_locale, translations, effective_at)
VALUES (
    'ltv_default_v1',
    1,
    'en',
    '{
        "en": [
            {
                "title": "Terms of Use",
                "content": "By accessing this platform, you agree to use it in accordance with applicable laws and these terms. Unauthorized use, reproduction, or distribution of platform content is prohibited."
            },
            {
                "title": "Privacy & Data",
                "content": "We collect and process personal data to provide our services. Your data is stored securely and not shared with third parties without your consent, except as required by law."
            }
        ],
        "pt-BR": [
            {
                "title": "Termos de Uso",
                "content": "Ao acessar esta plataforma, você concorda em utilizá-la em conformidade com as leis aplicáveis e estes termos. É proibido o uso não autorizado, reprodução ou distribuição do conteúdo da plataforma."
            },
            {
                "title": "Privacidade e Dados",
                "content": "Coletamos e processamos dados pessoais para prestação dos nossos serviços, em conformidade com a LGPD. Seus dados são armazenados com segurança e não são compartilhados com terceiros sem seu consentimento, salvo exigência legal."
            }
        ]
    }',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- +goose Down
DELETE FROM legal_term_versions WHERE id = 'ltv_default_v1';
