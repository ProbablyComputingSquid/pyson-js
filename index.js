class Type {
    constructor(type) {
        if (!["int", "float", "str", "list"].includes(type)) {
            throw new Error(`Invalid type: ${type}`);
        }
        this.type = type;
    }

    toString() {
        return this.type;
    }

    [Symbol.for("nodejs.util.inspect.custom")]() {
        return `pyson_data.Type(${this.type})`;
    }
}

class Value {
    constructor(value) {
        this.value = value;
        if (typeof value === "number") {
            this.type = new Type(Number.isInteger(value) ? "int" : "float");
        } else if (typeof value === "string") {
            this.type = new Type("str");
        } else if (Array.isArray(value)) {
            if (value.some((item) => typeof item !== "string")) {
                throw new Error("Lists in pyson must contain only strings");
            }
            this.type = new Type("list");
        } else {
            throw new Error(`Invalid pyson type: ${typeof value}`);
        }
    }

    toString() {
        return this.pysonStr();
    }

    [Symbol.for("nodejs.util.inspect.custom")]() {
        return `pyson_data.Value(type = ${this.type}, value = ${this.value})`;
    }

    type() {
        return this.type;
    }

    typeStr() {
        return this.type.toString();
    }

    value() {
        return this.value;
    }

    pysonStr() {
        return Array.isArray(this.value)
            ? `(*)`.join(this.value)
            : `${this.type}:${this.value}`;
    }

    isInt() {
        return this.type.type === "int";
    }

    isFloat() {
        return this.type.type === "float";
    }

    isStr() {
        return this.type.type === "str";
    }

    isList() {
        return this.type.type === "list";
    }
}

class NamedValue {
    constructor(name, value) {
        if (typeof name !== "string" || !(value instanceof Value)) {
            throw new Error("Invalid arguments for NamedValue");
        }
        this.name = name;
        this.value = value;
    }

    name() {
        return this.name;
    }

    changeName(newName) {
        this.name = newName;
    }

    swapName(newName) {
        const oldName = this.name;
        this.name = newName;
        return oldName;
    }

    type() {
        return this.value.type();
    }

    typeStr() {
        return this.value.typeStr();
    }

    value() {
        return this.value;
    }

    changeValue(newValue) {
        if (!(newValue instanceof Value)) {
            throw new Error("Invalid argument for changeValue");
        }
        this.value = newValue;
    }

    swapValue(newValue) {
        const oldValue = this.value;
        this.value = newValue;
        return oldValue;
    }

    toTuple() {
        return [this.name, this.value];
    }

    pysonStr() {
        return `${this.name}:${this.value}`;
    }

    toString() {
        return this.pysonStr();
    }

    [Symbol.for("nodejs.util.inspect.custom")]() {
        return `pyson_data.NamedValue(name = ${this.name}, value = ${this.value})`;
    }
}

function parsePysonEntry(entry) {
    if (entry.includes("\n")) {
        throw new Error("Pyson entries cannot contain newlines");
    }
    const [name, type, value] = entry.split(":", 2);
    switch (type) {
        case "int":
            value = parseInt(value, 10);
            break;
        case "float":
            value = parseFloat(value);
            break;
        case "list":
            value = value.split("(*)");
            break;
        default:
            throw new Error(`Invalid pyson type: ${type}`);
    }
    return new NamedValue(name, new Value(value));
}

function pysonToList(data) {
    const list = data
        .split("\n")
        .filter((line) => line)
        .map(parsePysonEntry);
    if (new Set(list.map((nv) => nv.name())).size !== list.length) {
        throw new Error("Duplicate name(s) found in pysonToList");
    }
    return list;
}

function pysonFileToList(filePath) {
    try {
        return pysonToList(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error(`File not found: ${filePath}`);
        } else if (error instanceof SyntaxError) {
            throw new Error(`Invalid pyson in file: ${filePath}`);
        } else {
            throw error;
        }
    }
}

function pysonToDict(data) {
    const list = pysonToList(data);
    const asDict = Object.fromEntries(
        list.map((nv) => [nv.name(), nv.value()]),
    );
    if (Object.keys(asDict).length !== list.length) {
        throw new Error("Duplicate name(s) found in pysonToDict");
    }
    return asDict;
}

function pysonFileToDict(filePath) {
    return pysonToDict(pysonFileToList(filePath));
}

function isValidPysonEntry(entry) {
    try {
        parsePysonEntry(entry);
        return true;
    } catch (error) {
        return false;
    }
}

function isValidPyson(data) {
    return data
        .split("\n")
        .every((line) => line === "" || isValidPysonEntry(line));
}

module.exports = {
    Type,
    Value,
    NamedValue,
    parsePysonEntry,
    pysonToList,
    pysonFileToList,
    pysonToDict,
    pysonFileToDict,
    isValidPysonEntry,
    isValidPyson,
};
