// const mysql = require('mysql2/promise');
// require('dotenv').config();

// async function setupDatabase() {
//   try {
//     // Use the correct env variables
//     const connection = await mysql.createConnection({
//       host: process.env.DB_HOST,
//       user: process.env.DB_USERNAME,     // fixed
//       password: process.env.DB_PASSWORD, // fixed
//       port: process.env.DB_PORT || 3306
//     });

//     console.log('Connected to MySQL server');

//     // Create the database if it doesn't exist
//     await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_DATABASE}\``);
//     console.log(`Database '${process.env.DB_DATABASE}' created or already exists`);

//     // Use the database
//     await connection.query(`USE \`${process.env.DB_DATABASE}\``);

//     // Create applications table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS applications (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         email VARCHAR(255) NOT NULL,
//         form_type ENUM('email_form', 'details_form', 'auto_webhook') NOT NULL,
//         form_id VARCHAR(100) NOT NULL,
//         response_id VARCHAR(100) NOT NULL,
//         form_data JSON NOT NULL,
//         email_verified BOOLEAN DEFAULT FALSE,
//         verification_token VARCHAR(100),
//         verification_sent_at TIMESTAMP NULL,
//         verified_at TIMESTAMP NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

//         INDEX idx_email (email),
//         INDEX idx_form_type (form_type),
//         INDEX idx_verification_token (verification_token),
//         INDEX idx_response_id (response_id)
//       )
//     `);

//     console.log('✅ Table created successfully');

//     await connection.end();
//     console.log('✅ Database setup complete!');
    
//   } catch (error) {
//     console.error('❌ Error setting up database:', error.message);
//     process.exit(1);
//   }
// }

// setupDatabase();




const mysql = require("mysql2/promise");
require("dotenv").config();

async function setupDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_DATABASE
      // ❌ NO SSL
    });

    console.log("✅ Connected to MySQL");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL,
        form_type ENUM('email_form', 'details_form', 'auto_webhook') NOT NULL,
        form_id VARCHAR(100) NOT NULL,
        response_id VARCHAR(100) NOT NULL,
        form_data JSON NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(100),
        verification_sent_at TIMESTAMP NULL,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        INDEX idx_email (email),
        INDEX idx_form_type (form_type),
        INDEX idx_verification_token (verification_token),
        INDEX idx_response_id (response_id)
      )
    `);

    console.log("✅ Table created successfully");

    await connection.end();
    console.log("🚀 Database setup complete");

  } catch (error) {
    console.error("❌ DB Setup Error:", error);
    process.exit(1);
  }
}

setupDatabase();
