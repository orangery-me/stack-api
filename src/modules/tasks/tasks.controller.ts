import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskDto } from './dto/task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { TaskCommentDto } from './dto/task-comment.dto';

@ApiTags('tasks')
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // ─── Task Lists ───────────────────────────────────────────

  @UseGuards(JwtAccessTokenGuard)
  @Post('workspaces/:workspaceId/channels/:channelId/task-lists')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new task list in a channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiBody({ type: CreateTaskListDto })
  @ApiResponse({ status: 201, description: 'Task list created' })
  async createTaskList(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() dto: CreateTaskListDto,
  ) {
    return this.tasksService.createTaskList(workspaceId, channelId, request.user.userId, dto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('workspaces/:workspaceId/channels/:channelId/task-lists')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all task lists in a channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({ status: 200, description: 'Task lists fetched' })
  async getTaskLists(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.tasksService.getTaskListsByChannel(workspaceId, channelId, request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch('workspaces/:workspaceId/task-lists/:taskListId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a task list (name, position)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'taskListId', description: 'Task list ID' })
  @ApiBody({ type: UpdateTaskListDto })
  @ApiResponse({ status: 200, description: 'Task list updated' })
  async updateTaskList(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskListId') taskListId: string,
    @Body() dto: UpdateTaskListDto,
  ) {
    return this.tasksService.updateTaskList(workspaceId, taskListId, request.user.userId, dto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Delete('workspaces/:workspaceId/task-lists/:taskListId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a task list (cascade delete tasks)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'taskListId', description: 'Task list ID' })
  @ApiResponse({ status: 200, description: 'Task list deleted' })
  async deleteTaskList(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskListId') taskListId: string,
  ) {
    return this.tasksService.deleteTaskList(workspaceId, taskListId, request.user.userId);
  }

  // ─── Tasks (scoped to task list) ──────────────────────────

  @UseGuards(JwtAccessTokenGuard)
  @Post('workspaces/:workspaceId/task-lists/:taskListId/tasks')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a task in a task list' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'taskListId', description: 'Task list ID' })
  @ApiBody({ type: CreateTaskDto })
  @ApiResponse({ status: 201, description: 'Task created', type: TaskDto })
  async createTask(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskListId') taskListId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<ResponseItem<TaskDto>> {
    return this.tasksService.createTask(workspaceId, taskListId, request.user.userId, dto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('workspaces/:workspaceId/task-lists/:taskListId/tasks')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get tasks in a task list' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'taskListId', description: 'Task list ID' })
  @ApiResponse({ status: 200, description: 'Tasks fetched' })
  async getTasksByList(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskListId') taskListId: string,
    @Query() filters: TaskFilterDto,
  ) {
    return this.tasksService.getTasksByList(workspaceId, taskListId, request.user.userId, filters);
  }

  // ─── Tasks (workspace-scoped by ID) ──────────────────────

  @UseGuards(JwtAccessTokenGuard)
  @Get('workspaces/:workspaceId/tasks/my')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all tasks assigned to current user' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'My tasks fetched' })
  async getMyTasks(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Query() filters: TaskFilterDto,
  ) {
    return this.tasksService.getMyTasks(workspaceId, request.user.userId, filters);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('workspaces/:workspaceId/tasks/:taskId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get task detail by ID' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, type: TaskDto })
  async getTaskById(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
  ): Promise<ResponseItem<TaskDto>> {
    return this.tasksService.getTaskById(workspaceId, taskId, request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch('workspaces/:workspaceId/tasks/:taskId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a task' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({ type: UpdateTaskDto })
  @ApiResponse({ status: 200, type: TaskDto })
  async updateTask(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<ResponseItem<TaskDto>> {
    return this.tasksService.updateTask(workspaceId, taskId, request.user.userId, dto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Delete('workspaces/:workspaceId/tasks/:taskId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Soft delete a task' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200 })
  async deleteTask(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
  ): Promise<ResponseItem<{ message: string }>> {
    return this.tasksService.deleteTask(workspaceId, taskId, request.user.userId);
  }

  // ─── Assign / Unassign ───────────────────────────────────

  @UseGuards(JwtAccessTokenGuard)
  @Post('workspaces/:workspaceId/tasks/:taskId/assignees')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Assign a user to a task' })
  @ApiBody({ type: AssignTaskDto })
  @ApiResponse({ status: 201, type: TaskDto })
  async assignTask(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AssignTaskDto,
  ): Promise<ResponseItem<TaskDto>> {
    return this.tasksService.assignTask(workspaceId, taskId, request.user.userId, dto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Delete('workspaces/:workspaceId/tasks/:taskId/assignees/:memberId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unassign a user from a task' })
  @ApiResponse({ status: 200, type: TaskDto })
  async unassignTask(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Param('memberId') memberId: string,
  ): Promise<ResponseItem<TaskDto>> {
    return this.tasksService.unassignTask(workspaceId, taskId, request.user.userId, memberId);
  }

  // ─── Task Comments ───────────────────────────────────────

  @UseGuards(JwtAccessTokenGuard)
  @Post('workspaces/:workspaceId/tasks/:taskId/comments')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create comment for a task' })
  @ApiBody({ type: CreateTaskCommentDto })
  @ApiResponse({ status: 201, type: TaskCommentDto })
  async addComment(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskCommentDto,
  ): Promise<ResponseItem<TaskCommentDto>> {
    return this.tasksService.addComment(workspaceId, taskId, request.user.userId, dto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('workspaces/:workspaceId/tasks/:taskId/comments')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get task comments' })
  @ApiResponse({ status: 200, type: [TaskCommentDto] })
  async getComments(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
  ): Promise<ResponseItem<TaskCommentDto[]>> {
    return this.tasksService.getComments(workspaceId, taskId, request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch('workspaces/:workspaceId/tasks/:taskId/comments/:commentId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update task comment' })
  @ApiBody({ type: UpdateTaskCommentDto })
  @ApiResponse({ status: 200, type: TaskCommentDto })
  async updateComment(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateTaskCommentDto,
  ): Promise<ResponseItem<TaskCommentDto>> {
    return this.tasksService.updateComment(workspaceId, taskId, commentId, request.user.userId, dto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Delete('workspaces/:workspaceId/tasks/:taskId/comments/:commentId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete task comment' })
  @ApiResponse({ status: 200 })
  async deleteComment(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
  ): Promise<ResponseItem<{ message: string }>> {
    return this.tasksService.deleteComment(workspaceId, taskId, commentId, request.user.userId);
  }
}
