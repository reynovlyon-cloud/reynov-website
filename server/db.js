const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'crm.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom     TEXT NOT NULL DEFAULT '',
    nom        TEXT DEFAULT '',
    email      TEXT DEFAULT '',
    tel        TEXT DEFAULT '',
    adresse    TEXT DEFAULT '',
    ville      TEXT DEFAULT '',
    notes      TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interventions (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id            INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    prestation           TEXT DEFAULT '',
    problemes            TEXT DEFAULT '',
    nb_jantes            TEXT DEFAULT '',
    taille               TEXT DEFAULT '',
    marque               TEXT DEFAULT '',
    modele               TEXT DEFAULT '',
    finition             TEXT DEFAULT '',
    mode                 TEXT DEFAULT '',
    adresse_intervention TEXT DEFAULT '',
    statut               TEXT DEFAULT 'nouveau',
    montant              REAL,
    notes                TEXT DEFAULT '',
    created_at           TEXT DEFAULT (datetime('now')),
    updated_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_inter_client ON interventions(client_id);
  CREATE INDEX IF NOT EXISTS idx_inter_statut  ON interventions(statut);
  CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
`);

const q = {
  stats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM clients)                                                              AS total_clients,
      (SELECT COUNT(*) FROM interventions)                                                        AS total_interventions,
      (SELECT COUNT(*) FROM interventions WHERE statut NOT IN ('termine','paye','annule'))        AS en_cours,
      (SELECT COUNT(*) FROM interventions WHERE statut = 'nouveau')                              AS nouveaux,
      (SELECT COALESCE(SUM(montant),0) FROM interventions WHERE statut = 'paye')                 AS ca_total,
      (SELECT COALESCE(SUM(montant),0) FROM interventions WHERE statut = 'paye'
         AND strftime('%Y-%m', created_at) = strftime('%Y-%m','now'))                            AS ca_mois
  `),

  clientsList: db.prepare(`
    SELECT c.*,
           COUNT(i.id)    AS nb_interventions,
           MAX(i.created_at) AS derniere_intervention,
           (SELECT statut FROM interventions WHERE client_id = c.id ORDER BY created_at DESC LIMIT 1) AS dernier_statut
    FROM clients c
    LEFT JOIN interventions i ON i.client_id = c.id
    WHERE c.prenom LIKE @q OR c.nom LIKE @q OR c.email LIKE @q OR c.tel LIKE @q OR c.ville LIKE @q
    GROUP BY c.id
    ORDER BY MAX(COALESCE(i.created_at, c.created_at)) DESC
  `),

  clientById: db.prepare(`SELECT * FROM clients WHERE id = ?`),

  clientInterventions: db.prepare(`
    SELECT * FROM interventions WHERE client_id = ? ORDER BY created_at DESC
  `),

  findByEmail: db.prepare(`SELECT * FROM clients WHERE LOWER(email) = LOWER(?) LIMIT 1`),

  createClient: db.prepare(`
    INSERT INTO clients (prenom, nom, email, tel, adresse, ville, notes)
    VALUES (@prenom, @nom, @email, @tel, @adresse, @ville, @notes)
  `),

  updateClient: db.prepare(`
    UPDATE clients SET prenom=@prenom, nom=@nom, email=@email,
    tel=@tel, adresse=@adresse, ville=@ville, notes=@notes WHERE id=@id
  `),

  deleteClient: db.prepare(`DELETE FROM clients WHERE id = ?`),

  createIntervention: db.prepare(`
    INSERT INTO interventions
      (client_id, prestation, problemes, nb_jantes, taille, marque, modele,
       finition, mode, adresse_intervention, statut, montant, notes)
    VALUES
      (@client_id, @prestation, @problemes, @nb_jantes, @taille, @marque, @modele,
       @finition, @mode, @adresse_intervention, @statut, @montant, @notes)
  `),

  updateIntervention: db.prepare(`
    UPDATE interventions
    SET statut=@statut, montant=@montant, notes=@notes, updated_at=datetime('now')
    WHERE id=@id
  `),

  deleteIntervention: db.prepare(`DELETE FROM interventions WHERE id = ?`),

  allInterventions: db.prepare(`
    SELECT i.*, c.prenom, c.nom, c.email, c.tel
    FROM interventions i
    JOIN clients c ON c.id = i.client_id
    ORDER BY i.created_at DESC
    LIMIT 200
  `),
};

module.exports = { db, q };
