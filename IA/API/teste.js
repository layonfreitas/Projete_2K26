const url = "https://projete-2k26.onrender.com/classificar/";




async function classificar(){
let imagem = document.getElementById('imagem');

let imagem_bytes = imagem.files[0];

const formData = new FormData();
    formData.append("imagem", imagem_bytes);

const response = await fetch(url, {
    method: "POST",
    body: formData
});


const data = await response.json();

const text_classificacao = document.getElementById("resultado_classificacao") 

text_classificacao.textContent = JSON.stringify(data.resultado);

}
