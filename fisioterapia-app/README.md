# Fisioterapia Landing Page

Landing page profissional para fisioterapeuta com painel administrativo seguro.

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (BROWSER)                       │
├─────────────────────────────────────────────────────────────┤
│  /public          │  /admin                                 │
│  • index.html     │  • login.html                           │
│  • css/styles.css │  • dashboard.html                       │
│  • js/main.js     │  • css/admin.css                        │
│                   │  • js/login.js                          │
│                   │  • js/dashboard.js                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR (Node.js)                        │
├─────────────────────────────────────────────────────────────┤
│  /server                                                     │
│  • app.js           (Express app principal)                 │
│  • init-db.js       (Inicializacao do banco)                │
│  /routes                                                     │
│  • public.js        (API publica)                           │
│  • admin.js         (API administrativa)                    │
│  • content.js       (API de conteudo)                       │
│  /middleware                                                 │
│  • auth.js          (Autenticacao e seguranca)              │
│  • errorHandler.js  (Tratamento de erros)                   │
│  /utils                                                      │
│  • validators.js    (Validacao de entrada)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     BANCO DE DADOS (SQLite)                  │
├─────────────────────────────────────────────────────────────┤
│  /database                                                   │
│  • fisioterapia.db  (Dados principais)                      │
│  • sessions.db      (Sessoes de usuario)                    │
└─────────────────────────────────────────────────────────────┘
```

## Funcionalidades

### Site Publico (Landing Page)
- **Hero Section**: Titulo, subtitulo, CTAs e estatisticas
- **Sobre**: Bio do fisioterapeuta, credenciais e areas de expertise
- **Servicos**: Lista de servicos oferecidos (editavel via admin)
- **Como Funciona**: Processo de atendimento em 4 etapas
- **Depoimentos**: Carrossel de depoimentos de pacientes
- **Galeria**: Preview estilo Instagram
- **Contato**: Formulario de contato e informacoes

### Painel Administrativo
- **Dashboard**: Estatisticas e acoes rapidas
- **Mensagens**: Visualizar, marcar como lida/excluir
- **Agendamentos**: Gerenciar solicitacoes de avaliacao
- **Depoimentos**: CRUD completo
- **Servicos**: CRUD completo
- **Conteudo**: Editar textos, contatos e redes sociais

## Requisitos

- Node.js 18+ 
- npm ou yarn

## Instalacao

1. **Clone ou extraia o projeto:**
```bash
cd fisioterapia-app
```

2. **Instale as dependencias:**
```bash
npm install
```

3. **Configure as variaveis de ambiente:**
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configuracoes:
- Altere `SESSION_SECRET` para uma string aleatoria segura
- Configure `ADMIN_PASSWORD` com uma senha forte
- Ajuste `ALLOWED_ORIGINS` para seus dominios em producao

4. **Inicialize o banco de dados:**
```bash
npm run init-db
```

Este comando criara:
- O banco de dados SQLite
- As tabelas necessarias
- O usuario administrador padrao
- Dados de exemplo (servicos e depoimentos)

5. **Inicie o servidor:**

Para desenvolvimento (com auto-reload):
```bash
npm run dev
```

Para producao:
```bash
npm start
```

6. **Acesse o site:**
- Site publico: http://localhost:3000
- Painel admin: http://localhost:3000/admin/login

## Credenciais Padrao

Apos executar `npm run init-db`, use:

- **Usuario:** admin
- **Senha:** Fisio@2026! (ou a definida em ADMIN_PASSWORD)

**IMPORTANTE:** Altere a senha padrao apos o primeiro login!

## Como Alterar a Senha do Admin

1. Faca login no painel administrativo
2. Acesse a secao de configuracoes (futura implementacao)
3. Ou use a API diretamente:

```bash
curl -X PUT http://localhost:3000/api/admin/password \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Fisio@2026!",
    "newPassword": "NovaSenhaSegura123!"
  }'
```

## Estrutura do Banco de Dados

### Tabelas Principais

```sql
-- Administradores
admins (id, username, password_hash, email, created_at, last_login, is_active)

-- Mensagens de contato
messages (id, name, email, phone, subject, message, is_read, created_at, ip_address)

-- Solicitacoes de agendamento
booking_requests (id, name, email, phone, preferred_date, preferred_time, 
                  service_type, notes, status, created_at, ip_address)

-- Servicos
services (id, title, description, icon, order_index, is_active, created_at, updated_at)

-- Depoimentos
testimonials (id, name, text, rating, is_active, created_at, updated_at)

-- Configuracoes do site
site_settings (id, key, value, updated_at)

-- Tentativas de login (seguranca)
login_attempts (id, ip_address, username, success, attempted_at)
```

## API Endpoints

### Publicos
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | /api/content | Conteudo completo do site |
| GET | /api/services | Lista de servicos |
| GET | /api/testimonials | Depoimentos ativos |
| POST | /api/contact | Enviar mensagem |
| POST | /api/booking/request | Solicitar agendamento |

### Administrativos (requer autenticacao)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | /api/admin/login | Autenticacao |
| POST | /api/admin/logout | Encerrar sessao |
| GET | /api/admin/session | Verificar sessao |
| PUT | /api/admin/password | Alterar senha |
| GET | /api/admin/stats | Estatisticas |
| GET | /api/admin/messages | Listar mensagens |
| PUT | /api/admin/messages/:id/read | Marcar como lida |
| DELETE | /api/admin/messages/:id | Excluir mensagem |
| GET | /api/admin/bookings | Listar agendamentos |
| PUT | /api/admin/bookings/:id/status | Atualizar status |
| GET | /api/admin/testimonials | Listar depoimentos |
| POST | /api/admin/testimonials | Criar depoimento |
| PUT | /api/admin/testimonials/:id | Atualizar depoimento |
| DELETE | /api/admin/testimonials/:id | Excluir depoimento |
| GET | /api/admin/services | Listar servicos |
| POST | /api/admin/services | Criar servico |
| PUT | /api/admin/services/:id | Atualizar servico |
| DELETE | /api/admin/services/:id | Excluir servico |
| GET | /api/content/settings | Obter configuracoes |
| PUT | /api/content/settings | Atualizar configuracoes |

## Medidas de Seguranca

### Implementadas
- **Hash de senhas:** bcrypt com 12 rounds
- **Sessoes seguras:** httpOnly, sameSite=strict
- **Rate limiting:** Limite de requisicoes por IP
- **Protecao CSRF:** Tokens CSRF para rotas admin
- **Headers de seguranca:** Helmet.js
- **CORS configuravel:** Origens permitidas controladas
- **Validacao de entrada:** Express Validator
- **Sanitizacao:** Escape de HTML para prevenir XSS
- **Bloqueio de IP:** Apos tentativas falhas de login
- **Logs de seguranca:** Registro de tentativas de login

### Recomendacoes para Producao
1. **HTTPS obrigatorio:** Configure SSL/TLS
2. **Reverse proxy:** Use Nginx ou similar
3. **Firewall:** Restrinja portas desnecessarias
4. **Backups:** Faca backups regulares do banco
5. **Monitoramento:** Implemente logs e alertas
6. **Atualizacoes:** Mantenha dependencias atualizadas

## Responsividade

O site e totalmente responsivo:
- **Desktop:** 1024px+
- **Tablet:** 768px - 1023px
- **Mobile:** 480px - 767px
- **Smartwatch:** <= 360px (layout simplificado)
- **Mini telas:** <= 280px

## Acessibilidade

- Semantica HTML5 correta
- Atributos ARIA para componentes interativos
- Navegacao por teclado completa
- Estados de foco visiveis
- Contraste adequado
- Suporte a prefers-reduced-motion

## Tecnologias Utilizadas

### Backend
- Node.js
- Express.js
- SQLite3
- bcrypt
- express-session
- express-rate-limit
- express-validator
- helmet
- cors
- csurf

### Frontend
- HTML5 semantico
- CSS3 (variaveis, flexbox, grid)
- JavaScript vanilla (ES6+)
- Fontes: Inter, Playfair Display

## Scripts Disponiveis

```bash
# Iniciar servidor (producao)
npm start

# Desenvolvimento com auto-reload
npm run dev

# Inicializar banco de dados
npm run init-db
```

## Estrutura de Pastas

```
fisioterapia-app/
├── .env                  # Variaveis de ambiente (nao versionar)
├── .env.example          # Exemplo de variaveis
├── package.json          # Dependencias e scripts
├── README.md             # Este arquivo
├── /database             # Banco de dados SQLite
│   ├── fisioterapia.db
│   └── sessions.db
├── /public               # Site publico
│   ├── index.html
│   ├── /css
│   │   └── styles.css
│   ├── /js
│   │   └── main.js
│   └── /assets
├── /admin                # Painel administrativo
│   ├── login.html
│   ├── dashboard.html
│   ├── /css
│   │   └── admin.css
│   └── /js
│       ├── login.js
│       └── dashboard.js
└── /server               # Backend
    ├── app.js
    ├── init-db.js
    ├── /routes
    │   ├── public.js
    │   ├── admin.js
    │   └── content.js
    ├── /middleware
    │   ├── auth.js
    │   └── errorHandler.js
    └── /utils
        └── validators.js
```

## Suporte

Para duvidas ou problemas:
1. Verifique os logs do servidor
2. Consulte a documentacao das dependencias
3. Verifique as configuracoes do .env

## Licenca

MIT License - Livre para uso pessoal e comercial.

---

**Desenvolvido em 2026** | Design profissional para fisioterapeutas
