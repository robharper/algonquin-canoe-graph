import Database from 'better-sqlite3';
import { findIntersections } from './lib/intersection.js';

function namePortages(db) {
  const allPortages = db.prepare(`SELECT * FROM features where featureType='portage'`);
  const updatePortage = db.prepare(`UPDATE features SET name=? WHERE id=?`);

  // for (const portage of allPortages.all()) {
  //   if (portage.name) {
  //     continue;
  //   }

  //   const intersections = findIntersections(db, portage, false);
  //   if (intersections.length > 0) {
  //     const intersectingNames = Array.from(new Set(intersections.map(f => f.feature.featureType === 'portage' ? null : f.feature.name).filter(f => f)));
  //     if (intersectingNames.length > 0) {
  //       const newName = intersectingNames.join(' - ') + ' Portage';
  //       updatePortage.run(newName, portage.id);
  //       console.log(`--Setting ${newName}`);
  //     }
  //   } else {
  //     console.log(`Portage ${portage.id} does not intersect with any features`);
  //   }
  // }

  // const river = db.prepare(`SELECT * FROM features where id=1182073959`);
  const river = db.prepare(`SELECT * FROM features where id=78412608`);
  const riverIntersections = findIntersections(db, river.get(), false);
  console.log(riverIntersections);
}

export function enrichDB() {
  const db = Database('./data/features.db');

  namePortages(db);
}
