from flask import Flask, request, jsonify
import subprocess

app = Flask(__name__)

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    prompt = data.get("prompt", "")

    # Commande pour exécuter llama.cpp avec le prompt
    result = subprocess.run(
        ["./main", "-m", "models/your-model.bin", "-p", prompt],
        capture_output=True,
        text=True,
    )

    return jsonify({"response": result.stdout})

if __name__ == "__main__":
    app.run(port=5000)
