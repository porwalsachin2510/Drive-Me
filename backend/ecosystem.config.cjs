module.exports = {
    apps: [
        {
            name: 'driveme-backend',
            script: 'src/index.js',
            cwd: '/root/Drive-Me/backend',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            error_file: '/root/.pm2/logs/driveme-backend-error.log',
            out_file: '/root/.pm2/logs/driveme-backend-out.log',
            log_file: '/root/.pm2/logs/driveme-backend-combined.log',
            time: true,
            node_args: '--experimental-specifier-resolution=node'
        }
    ]
};