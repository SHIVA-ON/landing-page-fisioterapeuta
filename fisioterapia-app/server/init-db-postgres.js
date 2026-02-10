/**
 * Inicializacao do banco PostgreSQL (Supabase/Railway).
 * Executar: npm run init-db
 */

const bcrypt = require('bcrypt');
require('dotenv').config();
const { getPool } = require('./db/sqlite-pg-compat');

const pool = getPool();

async function run() {
  console.log('=== Inicializando PostgreSQL ===');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT TRUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      preferred_date TEXT,
      preferred_time TEXT,
      service_type TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT,
      order_index INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id BIGSERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id BIGSERIAL PRIMARY KEY,
      ip_address TEXT NOT NULL,
      username TEXT,
      success BOOLEAN DEFAULT FALSE,
      attempted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Fisio@2026!';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fisioterapia.com';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await pool.query(
    `
      INSERT INTO admins (username, password_hash, email)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) DO NOTHING
    `,
    [adminUsername, passwordHash, adminEmail]
  );

  const defaultServices = [
    ['Fisioterapia Ortopedica', 'Tratamento de lesoes musculares, articulares e pos-operatorios com tecnicas avancadas de reabilitacao.', 'bone', 1],
    ['Fisioterapia Esportiva', 'Prevencao e tratamento de lesoes relacionadas a pratica de esportes e atividades fisicas.', 'activity', 2],
    ['Pilates Clinico', 'Metodo Pilates adaptado para reabilitacao, fortalecimento e melhora da postura.', 'user', 3],
    ['Liberacao Miofascial', 'Tecnica manual para aliviar tensoes musculares e restaurar a mobilidade tecidual.', 'hand', 4]
  ];

  for (const [title, description, icon, orderIndex] of defaultServices) {
    await pool.query(
      `
        INSERT INTO services (title, description, icon, order_index)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `,
      [title, description, icon, orderIndex]
    );
  }

  const defaultSettings = [
    ['hero_title', 'Fisioterapia Especializada para sua Recuperacao'],
    ['hero_subtitle', 'Tratamentos personalizados com foco em resultados. Recupere sua mobilidade e qualidade de vida.'],
    ['hero_image_url', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80'],
    ['about_image_url', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80'],
    ['site_name', 'Clinica de Fisioterapia'],
    ['whatsapp_number', '5511999999999'],
    ['instagram_url', 'https://instagram.com/fisioterapia'],
    ['facebook_url', 'https://facebook.com/fisioterapia'],
    ['email_contact', 'contato@fisioterapia.com'],
    ['phone_contact', '(11) 99999-9999'],
    ['address', 'Rua Exemplo, 123 - Sao Paulo, SP'],
    ['business_hours', 'Segunda a Sexta: 8h as 18h | Sabado: 8h as 12h'],
    ['show_testimonials', 'true'],
    ['show_gallery', 'true'],
    ['therapist_name', 'Dra. Ana Fisioterapeuta'],
    ['therapist_crefito', 'CREFITO-3/12345'],
    ['therapist_bio', 'Fisioterapeuta com mais de 10 anos de experiencia em reabilitacao ortopedica e esportiva.']
  ];

  for (const [key, value] of defaultSettings) {
    await pool.query(
      `
        INSERT INTO site_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING
      `,
      [key, value]
    );
  }

  console.log('=== PostgreSQL inicializado com sucesso ===');
  await pool.end();
}

run().catch(async (error) => {
  console.error('Erro ao inicializar PostgreSQL:', error);
  await pool.end();
  process.exit(1);
});
