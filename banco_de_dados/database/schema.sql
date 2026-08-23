CREATE DATABASE IF NOT EXISTS coffeeVision;
USE coffeeVision;
DROP TABLE IF EXISTS vinculos_agronomo;
DROP TABLE IF EXISTS lavouras;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios(
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

CREATE TABLE lavouras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nome_lavoura VARCHAR(100) NOT NULL,
    coordenadas JSON NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Vínculo entre um produtor e o agrônomo responsável por ele.
-- Quem cria/atualiza essa linha é a cooperativa (rota /vincular).
CREATE TABLE vinculos_agronomo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agronomo_id INT NOT NULL,
    produtor_id INT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agronomo_id) REFERENCES usuarios(id),
    FOREIGN KEY (produtor_id) REFERENCES usuarios(id),
    UNIQUE (produtor_id)
);