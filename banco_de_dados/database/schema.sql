CREATE DATABASE IF NOT EXISTS coffeeVision;
USE coffeeVision;
DROP TABLE IF EXISTS lavouras;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios(
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    confirma_nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(225) NOT NULL,
    confirma_senha_hash VARCHAR(255) NOT NULL,
    cidade VARCHAR(150) NOT NULL,
    cidade_lat DOUBLE NOT NULL,
    cidade_lon DOUBLE NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    codigo_recuperacao VARCHAR(6) NULL,
    codigo_expira_em TIMESTAMP NULL
);

CREATE TABLE lavouras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nome_lavoura VARCHAR(100) NOT NULL,
    coordenadas JSON NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);