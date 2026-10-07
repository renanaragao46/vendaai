# VendaAI WhatsApp Web Gateway

Gateway Node.js persistente para conectar números WhatsApp comuns ou Business por WhatsApp Web e integrar a sessão ao VendaAI.

## Variáveis
- PORT=8787
- GATEWAY_API_TOKEN=token privado entre VendaAI e gateway
- VENDAAI_WEBHOOK_URL=https://SEU-BACKEND/functions/v1/whatsapp-webhook
- VENDAAI_WEBHOOK_SECRET=segredo compartilhado com o Edge Function
- WHATSAPP_DATA_DIR=/data

O diretório `/data` precisa de armazenamento persistente para não perder a sessão após reinícios.

Este gateway não é uma API oficial da Meta. Use apenas para atendimento legítimo e mensagens solicitadas pelos clientes; não use para spam, disparos em massa ou contornar bloqueios.
