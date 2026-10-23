-- Banco temporário do protótipo (SQLite). Espelha o que irá para o Supabase.

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  -- Sempre minúsculo e sem espaços nas pontas
  email TEXT NOT NULL UNIQUE,
  -- scrypt$N$sal$hash; a senha em si nunca é gravada
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  -- Só dígitos, com DDD
  phone TEXT NOT NULL DEFAULT '',
  -- Só dígitos; pedido apenas de quem oferece serviços
  cpf TEXT UNIQUE,
  photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
  cep TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  number TEXT NOT NULL DEFAULT '',
  complement TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  -- Hash do token: quem ler o banco não consegue usar a sessão
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS professions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- Lista de serviços sugeridos, em JSON
  tasks TEXT NOT NULL,
  image_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS professionals (
  id TEXT PRIMARY KEY,
  -- Prestadores de exemplo não têm conta de login
  account_id TEXT UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  -- Dados públicos, copiados da conta quando ela é salva
  name TEXT NOT NULL,
  neighborhood TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
  about TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicado')),
  plan TEXT CHECK (plan IN ('mensal', 'semestral')),
  payment_method TEXT CHECK (payment_method IN ('pix', 'cartao')),
  trial_ends_at TEXT,
  rating REAL NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  -- Remover a modalidade apaga os serviços dela
  profession_id TEXT NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Reais inteiros; NULL = a combinar
  price INTEGER CHECK (price IS NULL OR price >= 0),
  position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS services_by_professional ON services (professional_id);
CREATE INDEX IF NOT EXISTS services_by_task ON services (profession_id, name);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  client TEXT NOT NULL,
  task TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  answered INTEGER NOT NULL DEFAULT 0 CHECK (answered IN (0, 1))
);

-- Uma linha só, editada na administração
CREATE TABLE IF NOT EXISTS plan_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  monthly_price REAL NOT NULL,
  semiannual_price REAL NOT NULL,
  trial_days INTEGER NOT NULL,
  gateway TEXT NOT NULL CHECK (gateway IN ('mercadopago', 'stripe', 'pagseguro')),
  pix_enabled INTEGER NOT NULL CHECK (pix_enabled IN (0, 1)),
  card_enabled INTEGER NOT NULL CHECK (card_enabled IN (0, 1))
);
