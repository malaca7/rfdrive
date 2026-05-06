# 🚀 Endpoints PHP - Documentação Completa

## Base URL
```
http://localhost:8000/rfdrive/php
```

## Autenticação

### Login
```
POST /auth.php
Content-Type: application/json

{
  "action": "login",
  "telefone": "11999999999",
  "senha": "senha123"
}

Response:
{
  "user": { id, nome, tipo, ... },
  "token": "base64_encoded_token",
  "session": { access_token, user }
}
```

### Obter Usuário Atual
```
POST /auth.php
Content-Type: application/json

{
  "action": "me",
  "token": "user_token"
}

Response: { id, nome, telefone, tipo, ... }
```

### Logout
```
// Simplesmente remova o token do localStorage
localStorage.removeItem('mysql_token');
```

## CRUD Genérico (api.php)

### SELECT
```
POST /api.php
{
  "table": "corridas",
  "action": "select",
  "filters": { "cliente_id": "user123" },
  "order": { "column": "created_at", "direction": "DESC" },
  "limit": 10
}
```

### INSERT
```
POST /api.php
{
  "table": "corridas",
  "action": "insert",
  "data": {
    "id": "ride_123",
    "cliente_id": "user_123",
    "origem_texto": "Centro",
    "destino_texto": "Aeroporto"
  }
}
```

### UPDATE
```
POST /api.php
{
  "table": "corridas",
  "action": "update",
  "data": { "status": "aprovada" },
  "filters": { "id": "ride_123" }
}
```

### DELETE
```
POST /api.php
{
  "table": "corridas",
  "action": "delete",
  "filters": { "id": "ride_123" }
}
```

### UPSERT
```
POST /api.php
{
  "table": "users",
  "action": "upsert",
  "data": { 
    "id": "user_123",
    "nome": "João",
    "telefone": "11999999999"
  }
}
```

## Endpoints Especializados (endpoints.php)

### Calcular Preço de Corrida
```
POST /endpoints.php
{
  "endpoint": "pricing/calculate",
  "origem": "Centro",
  "destino": "Aeroporto",
  "horario": "14:30:00"
}

Response:
{
  "preco_base": 50.00,
  "preco_final": 57.50,
  "regras_aplicadas": 1,
  "detalhes": { ... }
}
```

### Criar Corrida
```
POST /endpoints.php
{
  "endpoint": "rides/create",
  "cliente_id": "user_123",
  "origem_texto": "Rua A, 100",
  "destino_texto": "Rua B, 200"
}

Response: { success: true, id: "ride_..." }
```

### Atualizar Corrida
```
POST /endpoints.php
{
  "endpoint": "rides/update",
  "ride_id": "ride_123",
  "status": "aprovada",
  "motorista_id": "driver_456",
  "valor": 75.50
}
```

### Listar Corridas de um Usuário
```
POST /endpoints.php
{
  "endpoint": "rides/list",
  "filters": { "cliente_id": "user_123" }
}

Response: [ { id, cliente_id, status, ... }, ... ]
```

### Obter Corrida por ID
```
POST /endpoints.php
{
  "endpoint": "rides/getById",
  "ride_id": "ride_123"
}
```

### Motoristas Disponíveis
```
POST /endpoints.php
{
  "endpoint": "drivers/available",
  "latitude": -15.789,
  "longitude": -48.123,
  "raio_km": 5
}

Response: [
  { id, nome, tipo, distancia_km, latitude, longitude, ... },
  ...
]
```

### Atualizar Localização do Motorista
```
POST /endpoints.php
{
  "endpoint": "drivers/updateLocation",
  "motorista_id": "driver_123",
  "latitude": -15.789,
  "longitude": -48.123
}
```

### Criar Avaliação
```
POST /endpoints.php
{
  "endpoint": "evaluation/create",
  "corrida_id": "ride_123",
  "cliente_id": "user_123",
  "motorista_id": "driver_456",
  "nota": 4.5,
  "comentario": "Ótimo serviço!"
}
```

### Obter Links de Avaliação
```
POST /endpoints.php
{
  "endpoint": "evaluation/links",
  "motorista_id": "driver_123"
}
```

## Funções Especiais (functions.php)

### Reset de Senha
```
POST /functions.php
{
  "function": "reset-password",
  "body": {
    "userId": "user_123",
    "newPassword": "nova_senha"
  }
}
```

### Verificar Status de Pagamento Pix
```
POST /functions.php
{
  "function": "check-pix-status",
  "body": { "transactionId": "pix_123" }
}

Response:
{
  "status": "completed",
  "transactionId": "pix_123",
  "amount": 150.00,
  "timestamp": "2024-04-27T..."
}
```

### Criar Pagamento Pix
```
POST /functions.php
{
  "function": "create-pix-payment",
  "body": {
    "user_id": "user_123",
    "amount": 150.00
  }
}

Response:
{
  "success": true,
  "paymentId": "pix_...",
  "qrCode": "00020126580014...",
  "expiresAt": "2024-04-27T..."
}
```

### Webhook do MercadoPago
```
POST /functions.php
{
  "function": "mercadopago-webhook",
  "action": "payment.created",
  "data": { ... }
}
```

### Enviar Push Notification
```
POST /functions.php
{
  "function": "send-push",
  "body": {
    "userId": "user_123",
    "title": "Nova Corrida",
    "message": "Uma corrida foi oferecida para você"
  }
}
```

### Webhook do WhatsApp
```
POST /functions.php
{
  "function": "whatsapp-webhook",
  "from": "5511999999999",
  "message": "Quero uma corrida de centro para aeroporto"
}
```

### Parse de Corrida (IA)
```
POST /functions.php
{
  "function": "parse-ride",
  "body": {
    "text": "Preciso de uma corrida de centro para aeroporto",
    "audioUrl": "https://..."
  }
}

Response:
{
  "origem": "Centro",
  "destino": "Aeroporto",
  "confidence": 0.85
}
```

### Calcular Rota
```
POST /functions.php
{
  "function": "calculate-route",
  "body": {
    "origin": "Centro, SP",
    "destination": "Aeroporto, SP"
  }
}

Response:
{
  "distance": 25.5,
  "duration": 1800,
  "route": [ ... ],
  "polyline": "..."
}
```

## Upload de Arquivos

### Upload
```
POST /upload.php
Content-Type: multipart/form-data

file: <binary>
path: "users/123/avatar.jpg"

Response:
{
  "success": true,
  "url": "/rfdrive/uploads/users/123/avatar.jpg",
  "path": "users/123/avatar.jpg"
}
```

## Filtros Avançados

### Operadores Disponíveis
- `eq` - Igual (padrão)
- `gte` - Maior ou igual (`column_gte`)
- `lte` - Menor ou igual (`column_lte`)
- `gt` - Maior que (`column_gt`)
- `lt` - Menor que (`column_lt`)

### Exemplo com Filtro Gte
```
{
  "table": "corridas",
  "action": "select",
  "filters": {
    "valor_gte": 50.00,
    "status": "aprovada"
  }
}
```

## Ordenação

```
{
  "order": {
    "column": "created_at",
    "direction": "DESC"  // ou "ASC"
  }
}
```

## Paginação

```
{
  "limit": 10
}
```

## Tratamento de Erros

Todos os endpoints retornam:

**Sucesso:**
```json
{ "data": ... }
```

**Erro:**
```json
{ "error": "Mensagem de erro", "status": 400 }
```

### Códigos de Status HTTP
- `200` - OK
- `400` - Requisição inválida
- `401` - Não autenticado
- `403` - Acesso proibido
- `404` - Não encontrado
- `500` - Erro interno do servidor

## Exemplo Completo em TypeScript

```typescript
import { apiClient } from '@/lib/api-client';

async function getRideDetails(rideId: string) {
  try {
    const { data: ride, error } = await apiClient
      .from('corridas')
      .select()
      .eq('id', rideId)
      .single();

    if (error) {
      console.error('Erro ao buscar corrida:', error);
      return null;
    }

    return ride;
  } catch (err) {
    console.error('Erro:', err);
    return null;
  }
}

async function createRide(clientId: string, origin: string, destination: string) {
  const { data, error } = await apiClient
    .from('corridas')
    .insert({
      id: `ride_${Date.now()}`,
      cliente_id: clientId,
      origem_texto: origin,
      destino_texto: destination,
      status: 'em_analise'
    });

  if (error) {
    console.error('Erro ao criar corrida:', error);
    return null;
  }

  return data;
}

async function getUserRides(userId: string) {
  const { data: rides, error } = await apiClient
    .from('corridas')
    .select()
    .eq('cliente_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Erro ao buscar corridas:', error);
    return [];
  }

  return rides || [];
}
```

## Rate Limiting

Não implementado ainda. Adicione conforme necessário.

## Cache

Não implementado. Use `React Query` ou similar no frontend para cache.

---

**Última Atualização:** 27/04/2024
