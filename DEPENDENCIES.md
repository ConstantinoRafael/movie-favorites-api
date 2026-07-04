# Dependências futuras

Este documento descreve as dependências que **ainda não estão instaladas**, mas que costumam ser adicionadas conforme a aplicação evolui. Nenhuma delas foi implementada neste scaffold.

---

## Já instaladas (base do projeto)

| Pacote | Tipo | Finalidade |
|--------|------|------------|
| `@nestjs/common` | prod | Decorators, pipes, guards, filters e utilitários do framework |
| `@nestjs/core` | prod | Núcleo do NestJS (DI, lifecycle, módulos) |
| `@nestjs/platform-express` | prod | Adaptador HTTP com Express |
| `reflect-metadata` | prod | Metadados para decorators (requisito do NestJS) |
| `rxjs` | prod | Programação reativa usada internamente pelo NestJS |
| `typescript` | dev | Linguagem e compilador |
| `eslint` + `typescript-eslint` | dev | Análise estática de código |
| `prettier` + `eslint-config-prettier` | dev | Formatação e integração com ESLint |
| `jest` + `@nestjs/testing` | dev | Testes unitários e de integração |
| `@nestjs/cli` | dev | CLI para geração de módulos, controllers, etc. |

---

## Configuração e ambiente

### `@nestjs/config`

Carrega variáveis de ambiente (`.env`) de forma tipada e centralizada.

```bash
npm install @nestjs/config
```

**Uso previsto:** substituir o `AppConfigModule` local em `src/config/` por `ConfigModule.forRoot({ isGlobal: true })`.

---

## Validação de entrada

### `class-validator`

Decorators para validação de DTOs (`@IsString()`, `@IsEmail()`, etc.).

### `class-transformer`

Transforma payloads JSON em instâncias de classe (necessário para validação).

```bash
npm install class-validator class-transformer
```

**Uso previsto:** habilitar `ValidationPipe` global em `main.ts` e criar DTOs em cada módulo.

---

## Banco de dados

### Opção A — TypeORM

| Pacote | Finalidade |
|--------|------------|
| `@nestjs/typeorm` | Integração NestJS + TypeORM |
| `typeorm` | ORM |
| `pg` / `mysql2` | Driver do banco escolhido |

```bash
npm install @nestjs/typeorm typeorm pg
```

### Opção B — Prisma

| Pacote | Finalidade |
|--------|------------|
| `prisma` | CLI e schema (dev) |
| `@prisma/client` | Cliente gerado (prod) |

```bash
npm install prisma @prisma/client -D prisma
```

**Uso previsto:** camada de persistência isolada em cada módulo (repositories), sem acoplar controllers diretamente ao ORM.

---

## Autenticação e autorização

| Pacote | Finalidade |
|--------|------------|
| `@nestjs/passport` | Integração com Passport.js |
| `passport` | Estratégias de autenticação |
| `passport-jwt` ou `passport-local` | Estratégia JWT ou login/senha |
| `@nestjs/jwt` | Geração e verificação de tokens JWT |
| `bcrypt` | Hash de senhas |

```bash
npm install @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

**Uso previsto:** módulo `auth` em `src/modules/auth/` com guards em `src/common/guards/`.

---

## Documentação da API

### `@nestjs/swagger` + `swagger-ui-express`

Gera documentação OpenAPI/Swagger automaticamente a partir dos decorators.

```bash
npm install @nestjs/swagger swagger-ui-express
```

**Uso previsto:** configurar em `main.ts` com `SwaggerModule.setup()`.

---

## Cache

| Pacote | Finalidade |
|--------|------------|
| `@nestjs/cache-manager` | Módulo de cache do NestJS |
| `cache-manager` | Implementação de cache |
| `cache-manager-redis-store` | Store Redis (opcional) |

```bash
npm install @nestjs/cache-manager cache-manager
```

---

## Filas e processamento assíncrono

| Pacote | Finalidade |
|--------|------------|
| `@nestjs/bullmq` | Integração com BullMQ |
| `bullmq` | Filas baseadas em Redis |

```bash
npm install @nestjs/bullmq bullmq
```

**Uso previsto:** módulos de jobs em `src/modules/` com processors isolados.

---

## Logging estruturado

| Pacote | Finalidade |
|--------|------------|
| `nestjs-pino` ou `winston` | Logs estruturados em JSON |
| `pino-http` | Middleware HTTP para Pino |

```bash
npm install nestjs-pino pino-http
```

**Uso previsto:** interceptor de logging em `src/common/interceptors/`.

---

## Segurança HTTP

| Pacote | Finalidade |
|--------|------------|
| `helmet` | Headers de segurança HTTP |
| `@nestjs/throttler` | Rate limiting |

```bash
npm install helmet @nestjs/throttler
```

**Uso previsto:** configurar em `main.ts` e como guard global.

---

## Testes adicionais

| Pacote | Finalidade |
|--------|------------|
| `@faker-js/faker` | Dados fictícios para testes |
| `testcontainers` | Containers Docker em testes de integração |

```bash
npm install -D @faker-js/faker testcontainers
```

---

## Estrutura modular recomendada

Ao adicionar uma nova feature, crie um módulo em `src/modules/<feature>/`:

```
src/modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── dto/
│   ├── create-<feature>.dto.ts
│   └── update-<feature>.dto.ts
├── entities/          # ou repositories/ com Prisma
│   └── <feature>.entity.ts
└── index.ts           # barrel export
```

Registre o módulo em `AppModule.imports` e mantenha lógica compartilhada em `src/common/`.

---

## Comandos úteis

```bash
# Gerar novo módulo
nest g module modules/users

# Gerar controller + service dentro do módulo
nest g controller modules/users --flat
nest g service modules/users --flat

# Lint e formatação
npm run lint
npm run format
```
