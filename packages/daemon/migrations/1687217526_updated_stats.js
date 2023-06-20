migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("6o3kapl1cqnmalk")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "xqy35bed",
    "name": "daysUp",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "s8tytkni",
    "name": "runningInstanceCount",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "ehwz48sy",
    "name": "instanceCount",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "3ygyssxo",
    "name": "instanceCount1Hour",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "wyboqdlw",
    "name": "instanceCount1Day",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "kqbqjzqt",
    "name": "instanceCount7Day",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "vd81syq0",
    "name": "instanceCount30Day",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "vzyy0thy",
    "name": "invocationCount",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "hnw5i7gc",
    "name": "invocationCount1Hour",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "den6bbfr",
    "name": "invocationCount1Day",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "8ckuy6ef",
    "name": "invocationCount7Day",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pmu4v9wf",
    "name": "invocationCount30Day",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "tprglxb2",
    "name": "invocationSeconds",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "o7denxny",
    "name": "invocationSeconds1Hour",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "ltxzh3qv",
    "name": "invocationSeconds7Day",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "ztjq7j05",
    "name": "invocationSeconds30Day",
    "type": "number",
    "required": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("6o3kapl1cqnmalk")

  // remove
  collection.schema.removeField("xqy35bed")

  // remove
  collection.schema.removeField("s8tytkni")

  // remove
  collection.schema.removeField("ehwz48sy")

  // remove
  collection.schema.removeField("3ygyssxo")

  // remove
  collection.schema.removeField("wyboqdlw")

  // remove
  collection.schema.removeField("kqbqjzqt")

  // remove
  collection.schema.removeField("vd81syq0")

  // remove
  collection.schema.removeField("vzyy0thy")

  // remove
  collection.schema.removeField("hnw5i7gc")

  // remove
  collection.schema.removeField("den6bbfr")

  // remove
  collection.schema.removeField("8ckuy6ef")

  // remove
  collection.schema.removeField("pmu4v9wf")

  // remove
  collection.schema.removeField("tprglxb2")

  // remove
  collection.schema.removeField("o7denxny")

  // remove
  collection.schema.removeField("ltxzh3qv")

  // remove
  collection.schema.removeField("ztjq7j05")

  return dao.saveCollection(collection)
})
