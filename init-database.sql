-- Initialize separate database for each microservice
-- This script runs when PostgreSQL container starts for the first time

-- Create database for each service
CREATE DATABASE noteflow_auth;
CREATE DATABASE noteflow_users;
CREATE DATABASE noteflow_notes;
CREATE DATABASE noteflow_tags;


-- Grant permissions to the noteflow user
GRANT ALL PRIVILEGES ON DATABASE noteflow_auth TO noteflow;
GRANT ALL PRIVILEGES ON DATABASE noteflow_users TO noteflow;
GRANT ALL PRIVILEGES ON DATABASE noteflow_notes TO noteflow;
GRANT ALL PRIVILEGES ON DATABASE noteflow_tags TO noteflow;