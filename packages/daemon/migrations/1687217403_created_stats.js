migrate((db) => {
  const collection = new Collection({
    "id": "6o3kapl1cqnmalk",
    "created": "2023-06-19 23:30:03.171Z",
    "updated": "2023-06-19 23:30:03.171Z",
    "name": "stats",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "pdocjelv",
        "name": "userCount",
        "type": "number",
        "required": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null
        }
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("6o3kapl1cqnmalk");

  return dao.deleteCollection(collection);
})
