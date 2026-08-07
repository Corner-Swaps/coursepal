-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. COURSES
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_name VARCHAR(255) NOT NULL,
    course_code VARCHAR(50),
    term_weeks INT DEFAULT 16 CHECK (term_weeks BETWEEN 1 AND 24),
    sharing_code VARCHAR(12) UNIQUE NOT NULL,
    file_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. WEEKS
CREATE TABLE IF NOT EXISTS weeks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    week_number INT NOT NULL CHECK (week_number BETWEEN 0 AND 24),
    start_date DATE,
    theme VARCHAR(255),
    CONSTRAINT unique_course_week UNIQUE (course_id, week_number)
);

-- 4. READINGS
DO $$ BEGIN
    CREATE TYPE media_type_enum AS ENUM ('textbook', 'article', 'video', 'podcast', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    media_type media_type_enum DEFAULT 'textbook'
);

-- 5. ASSIGNMENTS
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    full_instructions TEXT,
    points_possible VARCHAR(50),
    weight_percentage VARCHAR(50)
);

-- 6. ENROLLMENTS
CREATE TABLE IF NOT EXISTS user_course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_course UNIQUE (user_id, course_id)
);

-- 7. USER PROGRESS (Isolated completion tracking per student)
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reading_id UUID NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_reading UNIQUE (user_id, reading_id)
);

-- 8. ASSIGNMENT NOTES (Personal scratchpad per user per assignment)
CREATE TABLE IF NOT EXISTS assignment_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_assignment_note UNIQUE (user_id, assignment_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_courses_file_hash ON courses(file_hash);
CREATE INDEX IF NOT EXISTS idx_weeks_course_id ON weeks(course_id);
CREATE INDEX IF NOT EXISTS idx_readings_week_id ON readings(week_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id, reading_id);
