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

    saveData: async function (jsonData) {
        if (!this.isConfigured) return { success: false, error: "Cloud not configured" };

        try {
            const BoletinData = Parse.Object.extend("BoletinData");
            const user = Parse.User.current();
            let cloudObject;

            if (user) {
                // 1. Authenticated User Logic
                const query = new Parse.Query(BoletinData);
                query.equalTo("owner", user);
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

            console.log("☁️ Saved to Cloud: ", cloudObject.id);
            return { success: true, id: cloudObject.id };

        } catch (error) {
            console.error('Error saving to cloud: ', error);
            // Handle session token expiry
            if (error.code === 209) {
                Parse.User.logOut();
                location.reload();
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
                    object = await query.get(existingId);
                }
            }

            if (object) {
                const jsonString = object.get("fullData");
                if (jsonString) {
                    return { success: true, data: JSON.parse(jsonString), empty: false };
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
    }
};

export default CloudStorage;
