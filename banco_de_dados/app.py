from flask import Flask
from flask_mysqldb import MySQL
from flask_cors import CORS
from config import Config
from routes.auth_routes import auth_bp, init_mysql as init_auth_mysql
from routes.lavoura_routes import lavoura_bp, init_mysql as init_lavoura_mysql
from routes.senha_routes import senha_bp, init_mysql as init_senha_mysql
from routes.agronomo_routes import agronomo_bp, init_mysql as init_agronomo_mysql
from routes.imagens_routes import cadastrar_imagens_bp, init_mysql as init_imagens_mysqlfrom routes.cooperativa_routes import cooperativa_bp, init_mysql as init_cooperativa_mysql


app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

mysql = MySQL(app)
init_auth_mysql(mysql)
init_lavoura_mysql(mysql)
init_senha_mysql(mysql)
init_agronomo_mysql(mysql)

app.register_blueprint(agronomo_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(lavoura_bp)
app.register_blueprint(senha_bp)

if __name__ == '__main__':
    app.run(debug=True, port=5000)