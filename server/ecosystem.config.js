module.exports = {
  apps: [
    {
      name: "ps5-xbox-server",
      script: "./index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};