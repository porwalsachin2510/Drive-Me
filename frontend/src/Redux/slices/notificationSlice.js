import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../utils/api'

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async ({ userId, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `/notifications/user/${userId}?page=${page}&limit=${limit}`
      )
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async ({ notificationId, userId }, { rejectWithValue }) => {
    try {
      const response = await api.patch(
        `/notifications/${notificationId}/read`,
        { userId }
      )
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const markAllNotificationsAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.patch(
        `/notifications/user/${userId}/read-all`,
        {}
      )
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const deleteNotification = createAsyncThunk(
  'notifications/deleteNotification',
  async ({ notificationId, userId }, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`, {
        data: { userId }
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

export const getUnreadNotificationCount = createAsyncThunk(
  'notifications/getUnreadCount',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/notifications/user/${userId}/unread-count`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message)
    }
  }
)

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  }
}

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addRealtimeNotification: (state, action) => {
      const notification = action.payload
      state.notifications.unshift(notification)
      if (!notification.isRead) {
        state.unreadCount += 1
      }
    },
    updateNotificationStatus: (state, action) => {
      const { notificationId, status } = action.payload
      const notification = state.notifications.find(n => n._id === notificationId)
      if (notification) {
        notification.status = status
        if (status === 'READ' && !notification.isRead) {
          notification.isRead = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      }
    },
    clearNotifications: (state) => {
      state.notifications = []
      state.unreadCount = 0
    },
    clearNotificationError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false
        const responseData = action.payload?.data || action.payload
        state.notifications = responseData?.notifications || []
        state.pagination = responseData?.pagination || state.pagination
        // Compute unread count from fetched notifications
        state.unreadCount = (state.notifications || []).filter(n => !n.isRead).length
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // Mark notification as read
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n._id === action.payload.data.notification._id)
        if (notification && !notification.isRead) {
          notification.isRead = true
          notification.readAt = action.payload.data.notification.readAt
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      })

      // Mark all notifications as read
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.notifications.forEach(notification => {
          if (!notification.isRead) {
            notification.isRead = true
            notification.readAt = new Date().toISOString()
          }
        })
        state.unreadCount = 0
      })

      // Delete notification
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const deletedId = action.payload.data.notification._id
        const deletedNotification = state.notifications.find(n => n._id === deletedId)
        if (deletedNotification && !deletedNotification.isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
        state.notifications = state.notifications.filter(n => n._id !== deletedId)
      })

      // Get unread count
      .addCase(getUnreadNotificationCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.data.unreadCount
      })
  }
})

export const {
  addRealtimeNotification,
  updateNotificationStatus,
  clearNotifications,
  clearNotificationError
} = notificationSlice.actions

export default notificationSlice.reducer
