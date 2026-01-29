const CloudStorage = {
    isConfigured: false,

    init: function () {
        // Credentials provided by user
        const APP_ID = 'ztIIuaL7HWfYr58CJtWbKgnpa0nxpo6EHYswkATj';
        const JS_KEY = 'qfb8Ja7gah2xi6GEy92YadyAosXSJ8N2wQxmURzL';

        if (typeof Parse === 'undefined') {
            console.error("Parse SDK not loaded!");
            return;
        }

        try {
            Parse.initialize(APP_ID, JS_KEY);
            Parse.serverURL = 'https://parseapi.back4app.com/';
            this.isConfigured = true;
            console.log("☁️ Connected to Back4App!");
        } catch (e) {
            console.error("Cloud Connection Error:", e);
        }
    },

    saveData: async function (jsonData, createHistory = false) {
        if (!this.isConfigured) return { success: false, error: "Cloud not configured" };

        try {
            const BoletinData = Parse.Object.extend("BoletinData");
            const user = Parse.User.current();
            let cloudObject;

            if (user) {
                // 1. Authenticated User Logic
                // 1. Authenticated User Logic
                const query = new Parse.Query(BoletinData);
                query.equalTo("owner", user);
                query.descending("createdAt"); // Get latest
                try {
                    cloudObject = await query.first(); // Find user's object
                    if (!cloudObject) {
                        cloudObject = new BoletinData();
                        cloudObject.set("owner", user);
                        // ACL: Private to User
                        const acl = new Parse.ACL(user);
                        acl.setPublicReadAccess(false);
                        acl.setPublicWriteAccess(false);
                        cloudObject.setACL(acl);
                    }
                } catch (e) {
                    cloudObject = new BoletinData();
                    cloudObject.set("owner", user);
                }
            } else {
                // 2. Guest Logic (Local Storage ID)
                // Warning: This data won't sync across devices
                const existingId = localStorage.getItem('minerd_cloud_id');
                if (existingId) {
                    const query = new Parse.Query(BoletinData);
                    try {
                        cloudObject = await query.get(existingId);
                    } catch (err) {
                        cloudObject = new BoletinData();
                    }
                } else {
                    cloudObject = new BoletinData();
                }
            }

            const jsonString = JSON.stringify(jsonData);
            cloudObject.set("fullData", jsonString);
            cloudObject.set("lastUpdate", new Date());
            cloudObject.set("clientVersion", "v2");

            await cloudObject.save();

            // Store ID locally just in case, but User Query is primary
            localStorage.setItem('minerd_cloud_id', cloudObject.id);

            // --- HISTORY SNAPSHOT TRIGGER ---
            if (user && createHistory) {
                const type = (createHistory === true) ? 'manual' : createHistory;
                // Run in background (don't await) to speed up UI response
                this.createHistorySnapshot(user, jsonString, type);
            }

            console.log("☁️ Saved to Cloud: ", cloudObject.id);
            return { success: true, id: cloudObject.id };

        } catch (error) {
            console.error('Error saving to cloud: ', error);
            // Handle session token expiry
            if (error.code === 209) {
                Parse.User.logOut();
                location.reload();
            }

            // Retry Strategy: If update failed (e.g. permission/lock), try creating a NEW object
            if (this.isConfigured && Parse.User.current() && error.code !== 209) {
                try {
                    console.warn("⚠️ Update failed, trying to create NEW cloud object...", error.message);
                    const BoletinData = Parse.Object.extend("BoletinData");
                    const retryObject = new BoletinData();
                    const user = Parse.User.current();
                    retryObject.set("owner", user);

                    // Force ACL
                    const acl = new Parse.ACL(user);
                    acl.setPublicReadAccess(false);
                    acl.setPublicWriteAccess(false);
                    retryObject.setACL(acl);

                    retryObject.set("fullData", JSON.stringify(jsonData));
                    retryObject.set("lastUpdate", new Date());
                    retryObject.set("clientVersion", "v2 (Retry)");

                    await retryObject.save();
                    console.log("✅ Auto-Retry successful: Created new object", retryObject.id);
                    return { success: true, id: retryObject.id };

                } catch (retryError) {
                    console.error("❌ Retry also failed:", retryError);
                }
            }

            return { success: false, error: error.message };
        }
    },

    loadData: async function () {
        if (!this.isConfigured) return { success: false, error: "Not Configured" };

        try {
            const BoletinData = Parse.Object.extend("BoletinData");
            const user = Parse.User.current();
            let object;

            if (user) {
                // 1. Load User's Data
                const query = new Parse.Query(BoletinData);
                query.equalTo("owner", user);
                // Sort by lastUpdate desc to get latest if duplicates exist
                query.descending("updatedAt");
                object = await query.first();
            } else {
                // 2. Load Local-Linked Data (Guest)
                const existingId = localStorage.getItem('minerd_cloud_id');
                if (existingId) {
                    const query = new Parse.Query(BoletinData);
                    try {
                        object = await query.get(existingId);
                    } catch (err) {
                        // Not found
                    }
                }
            }

            if (object) {
                const jsonString = object.get("fullData");
                if (jsonString) {
                    const data = JSON.parse(jsonString);
                    // Add timestamp from metadata if not in JSON
                    if (!data.timestamp) data.timestamp = object.updatedAt;
                    return { success: true, data: data, empty: false };
                } else {
                    return { success: true, data: null, empty: true };
                }
            } else {
                return { success: true, data: null, empty: true };
            }
        } catch (error) {
            console.error("Error loading cloud data:", error);
            if (error.code === 209) {
                Parse.User.logOut();
                location.reload();
            }
            return { success: false, error: error.message };
        }
    },

    // --- TIME MACHINE (HISTORY) ---

    // type = 'manual' | 'auto'
    createHistorySnapshot: async function (user, dataString, type = 'manual') {
        if (!user) return;

        // Throttling for Auto-Save: Only once every 24h
        if (type === 'auto') {
            const lastAuto = localStorage.getItem('minerd_last_auto_snapshot');
            const now = Date.now();
            if (lastAuto && (now - parseInt(lastAuto)) < (24 * 60 * 60 * 1000)) {
                // Skipped (Less than 24h)
                return;
            }
            localStorage.setItem('minerd_last_auto_snapshot', now.toString());
        }

        try {
            console.log(`🕰️ Creating History Snapshot (${type})...`);
            const BoletinHistory = Parse.Object.extend("BoletinHistory");
            const history = new BoletinHistory();

            history.set("owner", user);
            history.set("fullData", dataString);
            history.set("device", navigator.userAgent);
            history.set("snapshotType", type);

            // ACL (Private)
            const acl = new Parse.ACL(user);
            acl.setPublicReadAccess(false);
            history.setACL(acl);

            await history.save();
            console.log("✅ History Snapshot Saved:", history.id);

            // Prune old
            this.pruneHistoryLimit(user);

        } catch (e) {
            console.error("❌ Failed to create history snapshot:", e);
        }
    },

    pruneHistoryLimit: async function (user) {
        try {
            const query = new Parse.Query("BoletinHistory");
            query.equalTo("owner", user);
            query.descending("createdAt");
            query.skip(15); // Keep last 15 versions
            const oldRecords = await query.find();

            if (oldRecords.length > 0) {
                console.log(`🧹 Pruning ${oldRecords.length} old history records...`);
                Parse.Object.destroyAll(oldRecords);
            }
        } catch (e) {
            console.warn("Prune error:", e);
        }
    },

    fetchHistory: async function () {
        if (!Parse.User.current()) return { success: false, error: "No user" };

        try {
            const query = new Parse.Query("BoletinHistory");
            query.equalTo("owner", Parse.User.current());
            query.descending("createdAt");
            query.limit(20);
            query.select("createdAt", "device", "snapshotType");

            const results = await query.find();

            const historyList = results.map(r => ({
                id: r.id,
                date: r.createdAt,
                device: r.get("device"),
                type: r.get("snapshotType") || 'manual'
            }));

            return { success: true, list: historyList };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    loadHistoryItem: async function (id) {
        try {
            const query = new Parse.Query("BoletinHistory");
            const record = await query.get(id);
            const jsonString = record.get("fullData");
            return { success: true, data: JSON.parse(jsonString) };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
};

export default CloudStorage;
