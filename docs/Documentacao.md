## **1\) Visão do produto**

**Nome (exemplo):** BarberAge (SaaS multi-tenant)  
 **Objetivo:** permitir que barbearias gerenciem **agenda**, **profissionais**, **serviços**, **clientes**, **pagamentos** e **notificações**, com um painel admin e uma página de agendamento online.

### **Públicos (personas)**

* **Dono / Admin da barbearia:** configura serviços, horários, profissionais, vê relatórios.

* **Profissional (barbeiro):** vê agenda, confirma/cancela, bloqueia horários.

* **Cliente:** agenda, remarca, cancela, recebe lembretes.

---

## **2\) Escopo de funcionalidades**

### **MVP (primeira versão)**

**Multi-barbearia (multi-tenant)**

* Criar barbearia (workspace)

* Convidar equipe (admin/profissional)

**Serviços**

* CRUD de serviços (nome, preço, duração, descrição)

* Ativar/desativar serviço

**Agenda**

* Definir horários de funcionamento (por dia da semana)

* Agendamento com seleção:

  * serviço

  * profissional (ou “qualquer disponível”)

  * data/hora

* Regras:

  * não permitir conflito

  * respeitar duração do serviço

  * respeitar horários e bloqueios

**Clientes**

* Cadastro básico (nome, telefone, email)

* Histórico de agendamentos

**Status do agendamento**

* `pending`, `confirmed`, `cancelled`, `completed`, `no_show`

**Notificações (mínimo viável)**

* Enviar confirmação e lembrete (email/WhatsApp depois)

* Para MVP, pode ser só email via provedor

### **V2 (crescimento)**

* Pagamento online (Pix/cartão) \+ sinal

* Programas de fidelidade/cupom

* Relatórios (faturamento, serviços mais vendidos, ocupação)

* Várias unidades por barbearia

* Página pública por barbearia (link de agendamento)

* Integração com Google Calendar

* Lista de espera

* Assinatura mensal (Stripe)

---

## **3\) Requisitos não-funcionais (importantes no SaaS)**

* **Multi-tenant seguro:** dados de uma barbearia não podem vazar para outra

* **RLS no Supabase:** obrigatório

* **Performance:** índices em `appointments(shop_id, start_at)` e afins

* **Auditoria:** registrar alterações em agendamentos

* **Timezones:** guardar horários em `timestamptz` e padronizar

---

## **4\) Stack recomendada com Supabase**

### **Backend**

* **Supabase Postgres** (banco)

* **Supabase Auth** (login por email/senha e/ou OAuth)

* **Row Level Security (RLS)** (isolamento por barbearia)

* **Supabase Edge Functions**:

  * envio de emails/whatsapp

  * criação de checkout (Stripe)

  * webhooks (pagamento)

### **Frontend (opções)**

* **Next.js** (web admin \+ página de agendamento)

  * UI: shadcn/ui ou Chakra UI

* Alternativa: **React \+ Vite**

* Mobile futuramente: **React Native / Expo**

### **Infra e utilitários**

* Observabilidade: Sentry

* Logs e jobs: Edge Functions \+ cron (ou GitHub Actions/Trigger externo)

* Email: Resend, SendGrid, Postmark

* WhatsApp: Twilio / Z-API / 360dialog

---

## **5\) Modelagem do domínio (entidades)**

### **Principais tabelas**

* `shops` (barbearias / workspaces)

* `shop_members` (usuários e papéis por barbearia)

* `professionals` (profissionais — pode ser um member com perfil)

* `services` (serviços por barbearia)

* `clients` (clientes por barbearia)

* `appointments` (agendamentos)

* `business_hours` (horários por dia da semana)

* `time_off` (bloqueios/folgas do profissional ou da loja)

* (opcional) `payments` (pagamentos)

---

## **6\) Banco de dados (Postgres/Supabase) com Mermaid (ERD)**

Você pode colar isso no README ou numa doc e renderizar onde suportar Mermaid.

Diagrama  
`erDiagram`  
  `SHOPS ||--o{ SHOP_MEMBERS : has`  
  `SHOPS ||--o{ PROFESSIONALS : has`  
  `SHOPS ||--o{ SERVICES : has`  
  `SHOPS ||--o{ CLIENTS : has`  
  `SHOPS ||--o{ APPOINTMENTS : has`  
  `SHOPS ||--o{ BUSINESS_HOURS : defines`  
  `PROFESSIONALS ||--o{ TIME_OFF : blocks`  
  `PROFESSIONALS ||--o{ APPOINTMENTS : performs`  
  `SERVICES ||--o{ APPOINTMENT_SERVICES : includes`  
  `APPOINTMENTS ||--o{ APPOINTMENT_SERVICES : has`  
  `CLIENTS ||--o{ APPOINTMENTS : books`

  `SHOPS {`  
    `uuid id PK`  
    `text name`  
    `text slug`  
    `text phone`  
    `text address`  
    `text timezone`  
    `timestamptz created_at`  
  `}`

  `SHOP_MEMBERS {`  
    `uuid id PK`  
    `uuid shop_id FK`  
    `uuid user_id FK`  
    `text role "admin|professional|reception"`  
    `timestamptz created_at`  
  `}`

  `PROFESSIONALS {`  
    `uuid id PK`  
    `uuid shop_id FK`  
    `uuid user_id FK "nullable"`  
    `text name`  
    `text phone`  
    `boolean active`  
    `timestamptz created_at`  
  `}`

  `SERVICES {`  
    `uuid id PK`  
    `uuid shop_id FK`  
    `text name`  
    `int duration_minutes`  
    `numeric price`  
    `boolean active`  
    `timestamptz created_at`  
  `}`

  `CLIENTS {`  
    `uuid id PK`  
    `uuid shop_id FK`  
    `text name`  
    `text phone`  
    `text email`  
    `timestamptz created_at`  
  `}`

  `APPOINTMENTS {`  
    `uuid id PK`  
    `uuid shop_id FK`  
    `uuid client_id FK`  
    `uuid professional_id FK`  
    `timestamptz start_at`  
    `timestamptz end_at`  
    `text status "pending|confirmed|cancelled|completed|no_show"`  
    `text notes`  
    `timestamptz created_at`  
  `}`

  `APPOINTMENT_SERVICES {`  
    `uuid id PK`  
    `uuid appointment_id FK`  
    `uuid service_id FK`  
    `int duration_minutes`  
    `numeric price`  
  `}`

  `BUSINESS_HOURS {`  
    `uuid id PK`  
    `uuid shop_id FK`  
    `int weekday "0-6"`  
    `time start_time`  
    `time end_time`  
    `boolean closed`  
  `}`

  `TIME_OFF {`  
    `uuid id PK`  
    `uuid shop_id FK`  
    `uuid professional_id FK "nullable (null = loja toda)"`  
    `timestamptz start_at`  
    `timestamptz end_at`  
    `text reason`  
  `}`

---

## **7\) Regras de negócio essenciais (agenda)**

### **Conflito de horário**

Ao criar/editar um agendamento:

* `start_at < end_at`

* Não pode existir outro agendamento do mesmo profissional com overlap:

  * overlap se `(start_at < existing.end_at) AND (end_at > existing.start_at)`

* Tem que respeitar:

  * `business_hours` do dia

  * `time_off` do profissional (ou da loja)

**Dica forte:** crie uma *constraint* para conflito usando `EXCLUDE` com `tsrange` (é ouro pra agenda). Se quiser, eu te passo a SQL disso.

---

## **8\) API/Endpoints (se for Next.js \+ Supabase)**

### **Leitura pública (página de agendamento)**

* `GET /shops/:slug`

* `GET /shops/:shopId/services`

* `GET /shops/:shopId/professionals`

* `GET /shops/:shopId/availability?date=YYYY-MM-DD&serviceId=...&professionalId=...`

### **Ações do cliente**

* `POST /appointments` (criar)

* `PATCH /appointments/:id` (remarcar/cancelar)

* `GET /clients/:id/appointments`

### **Painel admin**

* CRUD: `services`, `professionals`, `business_hours`, `time_off`

* `GET /appointments?from&to&professionalId`

No Supabase, muitas dessas rotas podem ser só chamadas diretas via client (com RLS), e o que for sensível (ex: pagamento, whatsapp, webhooks) vai pra Edge Function.

---

## **9\) Segurança no Supabase (RLS) — o coração do SaaS**

Ideia padrão:

* Toda tabela tem `shop_id`

* Políticas:

  * membro da barbearia pode ver/alterar dados daquela barbearia

  * cliente (público) só pode criar agendamento e ver o próprio (se tiver login) ou via token

**Exemplo mental de política:**

* `shop_members.user_id = auth.uid()` e `shop_members.shop_id = table.shop_id`

Se você me disser se terá **cliente sem login** (só whatsapp/telefone), eu adapto o modelo com token e políticas específicas.

---

## **10\) Próximos passos (ordem prática pra construir)**

1. Criar schema do banco no Supabase (tabelas \+ índices)

2. Ativar RLS e policies

3. Fazer Admin (CRUD serviços/profissionais/horários)

4. Criar fluxo de agendamento (cliente)

5. Implementar verificação de disponibilidade (server-side)

6. Notificações (Edge Function)

7. Pagamento (Stripe) e assinatura do SaaS

URL DA API  
[https://jmcvtttxidbscwbfjudo.supabase.co](https://jmcvtttxidbscwbfjudo.supabase.co)  
Publishable Key  
sb\_publishable\_clJGK\_VOV-jwmBm1tXVEXQ\_prJ8\_HlD