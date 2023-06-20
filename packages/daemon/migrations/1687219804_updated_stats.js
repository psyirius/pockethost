migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("6o3kapl1cqnmalk")

  collection.listRule = ""

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("6o3kapl1cqnmalk")

  collection.listRule = null

  return dao.saveCollection(collection)
})
