CREATE DATABASE IF NOT EXISTS coffeeVision;
USE coffeeVision;

-- Ordem de DROP: tabelas "filhas" primeiro (quem tem FOREIGN KEY para outra
-- tabela), senão o MySQL recusa apagar por causa da dependência.
DROP TABLE IF EXISTS log_auditoria;
DROP TABLE IF EXISTS avisos;
DROP TABLE IF EXISTS imagens;
DROP TABLE IF EXISTS observacoes;
DROP TABLE IF EXISTS vinculos_agronomo;
DROP TABLE IF EXISTS lavouras;
DROP TABLE IF EXISTS usuarios;

-- ================================================================
-- USUÁRIOS (produtor, agronomo ou cooperativa, tudo na mesma tabela)
-- ================================================================
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    confirma_nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(225) NOT NULL,
    confirma_senha_hash VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    codigo_recuperacao VARCHAR(6) NULL,
    codigo_expira_em TIMESTAMP NULL,
    tipo ENUM('produtor', 'agronomo', 'cooperativa') NOT NULL DEFAULT 'produtor'
);

-- ================================================================
-- LAVOURAS (cada uma pertence a um produtor)
-- ================================================================
CREATE TABLE lavouras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nome_lavoura VARCHAR(100) NOT NULL,
    coordenadas JSON NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('ok', 'atencao', 'critico') NOT NULL DEFAULT 'ok',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ================================================================
-- VÍNCULO produtor <-> agrônomo responsável (criado pela cooperativa)
-- ================================================================
CREATE TABLE vinculos_agronomo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agronomo_id INT NOT NULL,
    produtor_id INT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agronomo_id) REFERENCES usuarios(id),
    FOREIGN KEY (produtor_id) REFERENCES usuarios(id),
    UNIQUE (produtor_id)
);

-- ================================================================
-- OBSERVAÇÕES de campo (do produtor ou do agrônomo, numa lavoura)
-- ================================================================
CREATE TABLE observacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lavoura_id INT NOT NULL,
    texto TEXT NOT NULL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    autor_id INT DEFAULT NULL,
    FOREIGN KEY (lavoura_id) REFERENCES lavouras(id),
    CONSTRAINT fk_observacoes_autor FOREIGN KEY (autor_id) REFERENCES usuarios(id)
);

-- ================================================================
-- IMAGENS (histórico de imagens/índices de vegetação por lavoura)
-- ================================================================
CREATE TABLE imagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    lavoura_id INT NOT NULL,
    url_imagem TEXT NOT NULL,
    data_imagem DATE NOT NULL,
    indice VARCHAR(100) DEFAULT NULL,
    FOREIGN KEY (lavoura_id) REFERENCES lavouras(id)
);

-- ================================================================
-- AVISOS (comunicados enviados pela cooperativa)
-- ================================================================
CREATE TABLE avisos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cooperativa_id INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensagem TEXT NOT NULL,
    destinatario_tipo ENUM('todos', 'produtores', 'agronomos') NOT NULL DEFAULT 'todos',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cooperativa_id) REFERENCES usuarios(id)
);

-- ================================================================
-- LOG DE AUDITORIA (registra quando um agrônomo age em nome de um produtor)
-- ================================================================
CREATE TABLE log_auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lavoura_id INT NOT NULL,
    autor_id INT NOT NULL,
    produtor_id INT NOT NULL,
    acao VARCHAR(100) NOT NULL,
    detalhe TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lavoura_id) REFERENCES lavouras(id),
    FOREIGN KEY (autor_id) REFERENCES usuarios(id),
    FOREIGN KEY (produtor_id) REFERENCES usuarios(id)
);