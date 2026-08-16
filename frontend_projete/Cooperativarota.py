from flask import Flask, request, jsonify
from flask_cors import CORS
from flask import Blueprint, request, jsonify
from MySQLdb import IntegrityError
import os
from dotenv import load_dotenv
from flask import app

@app.route("/agronomos", methods=["POST"])
def cadastrar_agronomo():
    # 1. Pega os dados que o front mandou no corpo da requisição
    dados = request.get_json()
    nome = dados.get("nome")
    crea = dados.get("crea")
    contato = dados.get("contato")
    area_atuacao = dados.get("areaAtuacao")

    # 2. Validação básica — igual o "if (!email || !senha)" do Login.jsx
    if not nome or not crea or not contato or not area_atuacao:
        return jsonify({"mensagem": "Preencha todos os campos."}), 400

    # 3. Tenta inserir no banco
    try:
        conexao = ...  # sua conexão MySQL já existente no projeto
        cursor = conexao.cursor()
        cursor.execute(
            "INSERT INTO agronomos (nome, crea, contato, area_atuacao) VALUES (%s, %s, %s, %s)",
            (nome, crea, contato, area_atuacao)
        )
        conexao.commit()
        return jsonify({"mensagem": "Agrônomo cadastrado com sucesso!"}), 201

    except IntegrityError:
        # 4. Trata o erro de UNIQUE (CREA repetido)
        return jsonify({"mensagem": "Esse CREA já está cadastrado."}), 409

    except Exception as erro:
        return jsonify({"mensagem": "Erro ao cadastrar agrônomo."}), 500