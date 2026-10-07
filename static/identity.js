(function() {
    'use strict';

    const currentKeys = {
        id: 'vibesync_user_id',
        name: 'vibesync_user_name',
        avatar: 'vibesync_user_avatar'
    };

    const legacyKeys = {
        id: 'airbeats_user_id',
        name: 'airbeats_user_name',
        avatar: 'airbeats_user_avatar'
    };

    function migrateLegacyIdentity() {
        for (const key of Object.keys(currentKeys)) {
            if (!localStorage.getItem(currentKeys[key])) {
                const legacyValue = localStorage.getItem(legacyKeys[key]);
                if (legacyValue) localStorage.setItem(currentKeys[key], legacyValue);
            }
        }
    }

    migrateLegacyIdentity();

    window.VibeSyncIdentity = {
        get(key) {
            return localStorage.getItem(currentKeys[key]) || localStorage.getItem(legacyKeys[key]) || '';
        },
        set(key, value) {
            if (value === null || value === undefined || value === '') {
                localStorage.removeItem(currentKeys[key]);
                return;
            }
            localStorage.setItem(currentKeys[key], value);
        },
        clear(key) {
            localStorage.removeItem(currentKeys[key]);
            localStorage.removeItem(legacyKeys[key]);
        },
        clearAll() {
            for (const key of Object.keys(currentKeys)) this.clear(key);
        }
    };
})();
