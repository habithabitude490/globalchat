-- Global Chat Platform - Seed Data
-- Insert sample users for development

INSERT INTO users (username, display_name, email, password_hash, country, languages, biography, interests, is_verified, status)
VALUES
    ('john_doe', 'John Doe', 'john@example.com', '$2a$10$placeholder_hash_change_me', 'United States', ARRAY['English', 'Spanish'], 'Software developer and avid traveler. Love meeting new people from around the world.', ARRAY['Technology', 'Travel', 'Photography'], TRUE, 'offline'),
    ('marie_curie', 'Marie Curie', 'marie@example.com', '$2a$10$placeholder_hash_change_me', 'France', ARRAY['French', 'English', 'Polish'], 'Scientist and researcher. Passionate about science and education.', ARRAY['Science', 'Education', 'Music'], TRUE, 'offline'),
    ('tanaka_kenji', 'Kenji Tanaka', 'kenji@example.com', '$2a$10$placeholder_hash_change_me', 'Japan', ARRAY['Japanese', 'English'], 'Engineer based in Tokyo. Interested in AI and robotics.', ARRAY['Technology', 'Robotics', 'Anime'], TRUE, 'offline'),
    ('sarah_mustafa', 'Sarah Mustafa', 'sarah@example.com', '$2a$10$placeholder_hash_change_me', 'Egypt', ARRAY['Arabic', 'English', 'French'], 'Architect and designer. Love art and history.', ARRAY['Architecture', 'Art', 'History'], TRUE, 'offline'),
    ('carlos_garcia', 'Carlos Garcia', 'carlos@example.com', '$2a$10$placeholder_hash_change_me', 'Mexico', ARRAY['Spanish', 'English'], 'Chef and food enthusiast. Sharing culinary traditions.', ARRAY['Cooking', 'Travel', 'Sports'], TRUE, 'offline'),
    ('olga_ivanova', 'Olga Ivanova', 'olga@example.com', '$2a$10$placeholder_hash_change_me', 'Russia', ARRAY['Russian', 'English', 'German'], 'Literature professor and writer.', ARRAY['Literature', 'Writing', 'Philosophy'], TRUE, 'offline'),
    ('wei_chen', 'Wei Chen', 'wei@example.com', '$2a$10$placeholder_hash_change_me', 'China', ARRAY['Chinese', 'English'], 'Photographer and visual artist.', ARRAY['Photography', 'Art', 'Design'], TRUE, 'offline'),
    ('emma_johnson', 'Emma Johnson', 'emma@example.com', '$2a$10$placeholder_hash_change_me', 'United Kingdom', ARRAY['English', 'French'], 'Journalist covering global affairs.', ARRAY['Journalism', 'Politics', 'Travel'], TRUE, 'offline'),
    ('ahmed_hassan', 'Ahmed Hassan', 'ahmed@example.com', '$2a$10$placeholder_hash_change_me', 'Saudi Arabia', ARRAY['Arabic', 'English'], 'Entrepreneur and business consultant.', ARRAY['Business', 'Technology', 'Fitness'], TRUE, 'offline'),
    ('lisa_andersson', 'Lisa Andersson', 'lisa@example.com', '$2a$10$placeholder_hash_change_me', 'Sweden', ARRAY['Swedish', 'English', 'Norwegian'], 'Environmental scientist and activist.', ARRAY['Environment', 'Science', 'Hiking'], TRUE, 'offline')
ON CONFLICT (username) DO NOTHING;
