import notifier from 'node-notifier';
import * as path from 'path';

export function notify(title: string, message: string, openPath?: string) {
    notifier.notify({
        title: `Hermes: ${title}`,
        message: message,
        sound: true,
        wait: false,
        timeout: 10
    });

    if (openPath) {
        notifier.on('click', () => {
            const { exec } = require('child_process');
            exec(`start "" "${openPath}"`);
        });
    }
}