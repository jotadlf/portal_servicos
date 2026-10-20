# Comandos básicos do Git

## Configuração (fazer uma vez só)

```bash
git config --global user.name "Jairon"
git config --global user.email "jairondlf@gmail.com"
git remote set-url origin https://jotadlf@github.com/jotadlf/portal_servicos.git
git config --global credential.helper manager
```

Na primeira vez que fizer `git push`, vai abrir a janela de login do GitHub.
Depois disso o login fica salvo e não é pedido de novo.

## Enviar tudo (commit + push)

```bash
git add .
git commit -m "mensagem"
git push
```

## Puxar tudo (pull)

```bash
git pull
```
