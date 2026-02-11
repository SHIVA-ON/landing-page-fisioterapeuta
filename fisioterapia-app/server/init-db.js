/**
 * ============================================================
 * INICIALIZACAO DO BANCO DE DADOS SQLITE
 * ============================================================
 * 
 * Script para criar o banco de dados e popular com dados iniciais
 * Executar: npm run init-db
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ============================================================
// CONFIGURACAO DE CAMINHOS
// ============================================================

const DB_DIR = path.join(__dirname, '../database');
const DB_PATH = path.join(DB_DIR, 'fisioterapia.db');

// Garante que o diretorio database existe
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('Diretorio database criado');
}

// ============================================================
// CONEXAO COM O BANCO DE DADOS
// ============================================================

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    process.exit(1);
  }
  console.log('Conectado ao banco de dados SQLite');
});

// ============================================================
// FUNCAO PARA EXECUTAR QUERIES COM PROMISES
// ============================================================

function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function getQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// ============================================================
// CRIACAO DAS TABELAS
// ============================================================

async function createTables() {
  console.log('\n=== Criando tabelas ===\n');

  // Tabela de administradores
  await runQuery(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active INTEGER DEFAULT 1
    )
  `);
  console.log('Tabela admins criada');

  // Tabela de mensagens de contato
  await runQuery(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    )
  `);
  console.log('Tabela messages criada');

  // Tabela de solicitacoes de agendamento
  await runQuery(`
    CREATE TABLE IF NOT EXISTS booking_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      preferred_date TEXT,
      preferred_time TEXT,
      service_type TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    )
  `);
  console.log('Tabela booking_requests criada');

  // Tabela de servicos
  await runQuery(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT,
      order_index INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Tabela services criada');

  // Tabela de depoimentos
  await runQuery(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Tabela testimonials criada');

  // Tabela de configuracoes do site
  await runQuery(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Tabela site_settings criada');

  // Tabela de tentativas de login (para rate limiting)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      username TEXT,
      success INTEGER DEFAULT 0,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Tabela login_attempts criada');

  console.log('\n=== Todas as tabelas criadas com sucesso ===\n');
}

// ============================================================
// INSERCAO DE DADOS INICIAIS
// ============================================================

async function seedData() {
  console.log('\n=== Inserindo dados iniciais ===\n');

  // Criar usuario admin padrao
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Fisio@2026!';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fisioterapia.com';

  // Hash da senha com bcrypt (12 rounds)
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Verifica se ja existe admin
  const existingAdmin = await getQuery('SELECT id FROM admins WHERE username = ?', [adminUsername]);
  
  if (!existingAdmin) {
    await runQuery(
      'INSERT INTO admins (username, password_hash, email) VALUES (?, ?, ?)',
      [adminUsername, passwordHash, adminEmail]
    );
    console.log('Usuario admin criado:');
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Senha: ${adminPassword}`);
    console.log(`  Email: ${adminEmail}`);
    console.log('\nIMPORTANTE: Altere a senha padrao apos o primeiro login!\n');
  } else {
    console.log('Usuario admin ja existe, pulando criacao');
  }

  // Inserir servicos padrao
  const defaultServices = [
    {
      title: 'Fisioterapia Ortopedica',
      description: 'Tratamento de lesoes musculares, articulares e pos-operatorios com tecnicas avancadas de reabilitacao.',
      icon: 'bone',
      order_index: 1
    },
    {
      title: 'Fisioterapia Esportiva',
      description: 'Prevencao e tratamento de lesoes relacionadas a pratica de esportes e atividades fisicas.',
      icon: 'activity',
      order_index: 2
    },
    {
      title: 'Pilates Clinico',
      description: 'Metodo Pilates adaptado para reabilitacao, fortalecimento e melhora da postura.',
      icon: 'user',
      order_index: 3
    },
    {
      title: 'Libergacao Miofascial',
      description: 'Tecnica manual para aliviar tensoes musculares e restaurar a mobilidade tecidual.',
      icon: 'hand',
      order_index: 4
    },
    {
      title: 'Reeducacao Postural',
      description: 'Correcao de desvios posturais e melhora do alinhamento corporal para prevenir dores.',
      icon: 'align',
      order_index: 5
    },
    {
      title: 'Fisioterapia Geriatrica',
      description: 'Cuidados especializados para idosos, focando em mobilidade, equilibrio e qualidade de vida.',
      icon: 'heart',
      order_index: 6
    }
  ];

  for (const service of defaultServices) {
    const existing = await getQuery('SELECT id FROM services WHERE title = ?', [service.title]);
    if (!existing) {
      await runQuery(
        'INSERT INTO services (title, description, icon, order_index) VALUES (?, ?, ?, ?)',
        [service.title, service.description, service.icon, service.order_index]
      );
      console.log(`Servico adicionado: ${service.title}`);
    }
  }

  // Inserir configuracoes padrao do site
  const defaultSettings = [
    { key: 'hero_title', value: 'Fisioterapia Especializada para sua Recuperacao' },
    { key: 'hero_subtitle', value: 'Tratamentos personalizados com foco em resultados. Recupere sua mobilidade e qualidade de vida.' },
    { key: 'hero_image_url', value: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80' },
    { key: 'about_image_url', value: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80' },
    { key: 'site_name', value: 'Clinica de Fisioterapia' },
    { key: 'whatsapp_number', value: '5511999999999' },
    { key: 'instagram_url', value: 'https://instagram.com/fisioterapia' },
    { key: 'facebook_url', value: 'https://facebook.com/fisioterapia' },
    { key: 'email_contact', value: 'contato@fisioterapia.com' },
    { key: 'phone_contact', value: '(11) 99999-9999' },
    { key: 'address', value: 'Rua Exemplo, 123 - Sao Paulo, SP' },
    { key: 'business_hours', value: 'Segunda a Sexta: 8h as 18h | Sabado: 8h as 12h' },
    { key: 'show_testimonials', value: 'true' },
    { key: 'show_gallery', value: 'true' },
    { key: 'email_notifications_enabled', value: 'true' },
    { key: 'therapist_name', value: 'Dra. Ana Fisioterapeuta' },
    { key: 'therapist_crefito', value: 'CREFITO-3/12345' },
    { key: 'therapist_bio', value: 'Fisioterapeuta com mais de 10 anos de experiencia em reabilitacao ortopedica e esportiva. Especialista em Pilates clinico e libergacao miofascial.' }
  ];

  for (const setting of defaultSettings) {
    const existing = await getQuery('SELECT id FROM site_settings WHERE key = ?', [setting.key]);
    if (!existing) {
      await runQuery(
        'INSERT INTO site_settings (key, value) VALUES (?, ?)',
        [setting.key, setting.value]
      );
      console.log(`Configuracao adicionada: ${setting.key}`);
    }
  }

  console.log('\n=== Dados iniciais inseridos com sucesso ===\n');
}

// ============================================================
// EXECUCAO PRINCIPAL
// ============================================================

async function main() {
  try {
    console.log('========================================');
    console.log('INICIALIZACAO DO BANCO DE DADOS');
    console.log('========================================\n');

    await createTables();
    await seedData();

    console.log('========================================');
    console.log('BANCO DE DADOS INICIALIZADO COM SUCESSO!');
    console.log('========================================');
    console.log(`\nBanco de dados: ${DB_PATH}`);
    console.log('\nPara iniciar o servidor:');
    console.log('  npm start');
    console.log('\nPara desenvolvimento:');
    console.log('  npm run dev');
    console.log('========================================');

  } catch (error) {
    console.error('\nErro durante inicializacao:', error.message);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Erro ao fechar conexao:', err.message);
      } else {
        console.log('\nConexao com banco de dados fechada');
      }
    });
  }
}

// Executa a inicializacao
main();
