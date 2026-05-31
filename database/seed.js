require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Use the same database initialization
process.env.DB_PATH = path.join(__dirname, '..', 'data', 'chatworld.sqlite');

const initSqlJs = require('sql.js');
const fs = require('fs');

async function seed() {
    const SQL = await initSqlJs();
    const dbPath = process.env.DB_PATH;

    if (!fs.existsSync(dbPath)) {
        console.log('[Seed] Database file not found. Run db:migrate first.');
        process.exit(1);
    }

    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    db.run('PRAGMA foreign_keys=ON');

    const users = [
        { username: 'john_doe', display_name: 'John Doe', email: 'john@example.com', country: 'United States', languages: JSON.stringify(['English', 'Spanish']), biography: 'Software developer and avid traveler. Love meeting new people from around the world.', interests: JSON.stringify(['Technology', 'Travel', 'Photography']) },
        { username: 'marie_curie', display_name: 'Marie Curie', email: 'marie@example.com', country: 'France', languages: JSON.stringify(['French', 'English', 'Polish']), biography: 'Scientist and researcher. Passionate about science and education.', interests: JSON.stringify(['Science', 'Education', 'Music']) },
        { username: 'tanaka_kenji', display_name: 'Kenji Tanaka', email: 'kenji@example.com', country: 'Japan', languages: JSON.stringify(['Japanese', 'English']), biography: 'Engineer based in Tokyo. Interested in AI and robotics.', interests: JSON.stringify(['Technology', 'Robotics']) },
        { username: 'sarah_mustafa', display_name: 'Sarah Mustafa', email: 'sarah@example.com', country: 'Egypt', languages: JSON.stringify(['Arabic', 'English', 'French']), biography: 'Architect and designer. Love art and history.', interests: JSON.stringify(['Architecture', 'Art', 'History']) },
        { username: 'carlos_garcia', display_name: 'Carlos Garcia', email: 'carlos@example.com', country: 'Mexico', languages: JSON.stringify(['Spanish', 'English']), biography: 'Chef and food enthusiast. Sharing culinary traditions.', interests: JSON.stringify(['Cooking', 'Travel', 'Sports']) },
        { username: 'olga_ivanova', display_name: 'Olga Ivanova', email: 'olga@example.com', country: 'Russia', languages: JSON.stringify(['Russian', 'English', 'German']), biography: 'Literature professor and writer.', interests: JSON.stringify(['Literature', 'Writing', 'Philosophy']) },
        { username: 'wei_chen', display_name: 'Wei Chen', email: 'wei@example.com', country: 'China', languages: JSON.stringify(['Chinese', 'English']), biography: 'Photographer and visual artist.', interests: JSON.stringify(['Photography', 'Art', 'Design']) },
        { username: 'emma_johnson', display_name: 'Emma Johnson', email: 'emma@example.com', country: 'United Kingdom', languages: JSON.stringify(['English', 'French']), biography: 'Journalist covering global affairs.', interests: JSON.stringify(['Journalism', 'Politics', 'Travel']) },
        { username: 'ahmed_hassan', display_name: 'Ahmed Hassan', email: 'ahmed@example.com', country: 'Saudi Arabia', languages: JSON.stringify(['Arabic', 'English']), biography: 'Entrepreneur and business consultant.', interests: JSON.stringify(['Business', 'Technology', 'Fitness']) },
        { username: 'lisa_andersson', display_name: 'Lisa Andersson', email: 'lisa@example.com', country: 'Sweden', languages: JSON.stringify(['Swedish', 'English', 'Norwegian']), biography: 'Environmental scientist and activist.', interests: JSON.stringify(['Environment', 'Science', 'Hiking']) }
    ];

    console.log('[Seed] Inserting seed data...');

    for (const user of users) {
        const hash = '$2a$12$placeholder_hash_for_development_only';
        const id = uuidv4();
        try {
            db.run(
                `INSERT OR IGNORE INTO users (id, username, display_name, email, password_hash, country, languages, biography, interests, is_verified, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'offline')`,
                [id, user.username, user.display_name, user.email, hash, user.country, user.languages, user.biography, user.interests]
            );
        } catch (e) {
            // ignore duplicates
        }
    }

    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    db.close();

    console.log('[Seed] Seed data inserted successfully.');
}

seed().catch(err => {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
});
