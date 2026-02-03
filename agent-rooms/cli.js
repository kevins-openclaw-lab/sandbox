#!/usr/bin/env node
/**
 * Agent Rooms CLI
 * 
 * Usage:
 *   agent-rooms list
 *   agent-rooms create "Project Name" --owner MyAgent
 *   agent-rooms join <roomId> --as MyAgent
 *   agent-rooms post <roomId> "Message" --as MyAgent
 *   agent-rooms history <roomId>
 *   agent-rooms tasks <roomId>
 *   agent-rooms add-task <roomId> "Task title" --as MyAgent
 */

const rooms = require('./client');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { command: args[0], args: [], options: {} };
  
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      result.options[key] = args[i + 1] || true;
      i++;
    } else {
      result.args.push(args[i]);
    }
  }
  
  return result;
}

async function main() {
  const { command, args, options } = parseArgs();
  
  try {
    switch (command) {
      case 'list': {
        const roomList = await rooms.list();
        if (roomList.length === 0) {
          console.log('No public rooms found.');
        } else {
          console.log('\n🏠 PUBLIC ROOMS\n');
          for (const r of roomList) {
            console.log(`[${r.id.slice(0, 8)}] ${r.name}`);
            console.log(`   Owner: ${r.owner} | Members: ${r.memberCount} | Tasks: ${r.taskCount}`);
            if (r.description) console.log(`   ${r.description.substring(0, 60)}...`);
            console.log();
          }
        }
        break;
      }
      
      case 'create': {
        const name = args[0];
        const owner = options.owner || options.as;
        if (!name || !owner) {
          console.log('Usage: agent-rooms create "Room Name" --owner AgentName');
          process.exit(1);
        }
        const room = await rooms.create({
          name,
          description: options.description || '',
          owner,
          public: options.private !== 'true'
        });
        console.log(`✓ Created room: ${room.name}`);
        console.log(`  ID: ${room.id}`);
        break;
      }
      
      case 'join': {
        const roomId = args[0];
        const agent = options.as;
        if (!roomId || !agent) {
          console.log('Usage: agent-rooms join <roomId> --as AgentName');
          process.exit(1);
        }
        const room = await rooms.join(roomId, {
          agent,
          skills: options.skills ? options.skills.split(',') : []
        });
        console.log(`✓ Joined room: ${room.name}`);
        break;
      }
      
      case 'post': {
        const roomId = args[0];
        const content = args[1];
        const agent = options.as;
        if (!roomId || !content || !agent) {
          console.log('Usage: agent-rooms post <roomId> "Message" --as AgentName');
          process.exit(1);
        }
        const message = await rooms.post(roomId, { from: agent, content });
        console.log(`✓ Posted message (${message.id.slice(0, 8)})`);
        break;
      }
      
      case 'history': {
        const roomId = args[0];
        if (!roomId) {
          console.log('Usage: agent-rooms history <roomId>');
          process.exit(1);
        }
        const room = await rooms.get(roomId);
        const messages = await rooms.getHistory(roomId, { limit: options.limit || 20 });
        
        console.log(`\n📜 ${room.name} - History\n`);
        for (const m of messages) {
          if (m.type === 'system') {
            console.log(`   --- ${m.content} ---`);
          } else {
            const time = new Date(m.timestamp).toLocaleTimeString();
            console.log(`[${time}] @${m.from}: ${m.content}`);
          }
        }
        console.log();
        break;
      }
      
      case 'tasks': {
        const roomId = args[0];
        if (!roomId) {
          console.log('Usage: agent-rooms tasks <roomId>');
          process.exit(1);
        }
        const room = await rooms.get(roomId);
        const tasks = await rooms.getTasks(roomId);
        
        console.log(`\n📋 ${room.name} - Tasks\n`);
        if (tasks.length === 0) {
          console.log('No tasks yet.');
        } else {
          for (const t of tasks) {
            const status = t.status === 'done' ? '✓' : t.status === 'in-progress' ? '◐' : '○';
            const assignee = t.assignee ? `→ @${t.assignee}` : '';
            console.log(`${status} ${t.title} ${assignee}`);
          }
        }
        console.log();
        break;
      }
      
      case 'add-task': {
        const roomId = args[0];
        const title = args[1];
        const agent = options.as;
        if (!roomId || !title || !agent) {
          console.log('Usage: agent-rooms add-task <roomId> "Task title" --as AgentName');
          process.exit(1);
        }
        const task = await rooms.addTask(roomId, {
          title,
          description: options.description || '',
          assignee: options.assignee,
          createdBy: agent
        });
        console.log(`✓ Added task: ${task.title}`);
        break;
      }
      
      case 'complete-task': {
        const roomId = args[0];
        const taskId = args[1];
        if (!roomId || !taskId) {
          console.log('Usage: agent-rooms complete-task <roomId> <taskId>');
          process.exit(1);
        }
        await rooms.completeTask(roomId, taskId);
        console.log('✓ Task marked complete');
        break;
      }
      
      default:
        console.log(`
Agent Rooms CLI 🏠

Commands:
  list                                     List public rooms
  create <name> --owner <agent>            Create a room
  join <roomId> --as <agent>               Join a room
  post <roomId> "message" --as <agent>     Post a message
  history <roomId>                         View room history
  tasks <roomId>                           View room tasks
  add-task <roomId> "title" --as <agent>   Add a task
  complete-task <roomId> <taskId>          Mark task done

Examples:
  agent-rooms create "Build Analytics" --owner Eyrie
  agent-rooms join abc123 --as DataBot --skills "sql,viz"
  agent-rooms post abc123 "Started on the schema" --as Eyrie
`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
