// import StorageOrm from ".";
// import { LocalStorage } from "./drivers/LocalStorage";

// type NameDB = {
//     posts: {
//         _id: string;
//         title: string;
//         body: string;
//     };
//     comments: {
//         _id: string;
//         postId: string;
//         body: string;
//     }
// }

// const db = StorageOrm.db<NameDB>("name", {
//     driver: new LocalStorage()
// })

// const collection = db.collection("comments")

// console.time("native")
// for (let i = 0; i < 1000; i++) {
//     const json = localStorage.getItem("native")
//     const data = json ? JSON.parse(json) : []
//     data.push({
//         _id: 1,
//         postId: "text",
//         body: "text"
//     })
//     localStorage.setItem("native", JSON.stringify(data))
// }
// console.timeEnd("native")


// console.time("storageORM")
// for (let i = 0; i < 1000; i++) {
//     collection.insertOne({
//         postId: "text",
//         body: "text"
//     })
// }
// console.timeEnd("storageORM")



import { LocalStorage } from "./drivers/LocalStorage";
import { StorageORM } from "./ORM";

const orm = new StorageORM()


const db = orm.db("db1", {
    driver: new LocalStorage(),
})

const db2 = orm.db("db2", {
    driver: new LocalStorage({ cacheInMemory: false }),
})

const collection = db.collection<{ name: string, test: number }>("col1")
const collection2 = db2.collection<{ name: string, test: number }>("col2")

// console.time("before");
// (async () => collection.insertMany(Array(100_000).fill(undefined).map(() => ({
//     name: "Eee",
//     test: 222
// }))))()
// console.timeEnd("before");

const obj = {
    name: "Eee",
    test: 222
}

// console.time("native")
// for (let i = 0; i < 1000; i++) {
//     const json = localStorage.getItem("native");
//     const data = json ? JSON.parse(json) : []
//     data.push({ _id: 5, name: "text", test: 222 })
//     localStorage.setItem("native", JSON.stringify(data))
// }
// console.timeEnd("native")


// console.time("saveInMemory=true")
// for (let i = 0; i < 1000; i++) {
//     collection.insertOne(obj)
// }
// console.timeEnd("saveInMemory=true")


// console.time("saveInMemory=false")
// for (let i = 0; i < 1000; i++) {
//     collection2.insertOne(obj)
// }
// console.timeEnd("saveInMemory=false")



// console.time("localStorage")
// for (let i = 0; i < 1000; i++) {
//     let prev = localStorage.getItem("onlyLocalStorage") || ""
//     prev += `{name: "arash", test: 12345}`
//     localStorage.setItem("onlyLocalStorage", prev)
// }
// console.timeEnd("localStorage")


// console.time("json")
// let json: string = "[]";
// for (let i = 0; i < 1000; i++) {
//     let prev: any;
//     try {
//         prev = JSON.parse(json) || []
//     } catch {
//         prev = []
//     }
//     prev.push({ name: "arash", test: 12345 })
//     json += JSON.stringify(prev)
// }
// console.timeEnd("json")