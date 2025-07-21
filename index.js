const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post('/moderar', async (req, res) => {
  const { texto } = req.body;

  if (!texto) {
    return res.status(400).json({ error: 'Texto é obrigatório' });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: texto }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: "Erro ao acessar API OpenAI", details: err });
    }

    const data = await response.json();

    // Aqui você pode ajustar a resposta que quer enviar pro frontend
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Porta padrão para Render é 10000
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));